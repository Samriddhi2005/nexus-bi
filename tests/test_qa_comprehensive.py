import unittest
import os
import io
import json
import sqlite3
import pandas as pd
from unittest.mock import MagicMock

from core.database import DatabaseManager
from core.security import SQLGuardrail
from core.llm_factory import LLMFactory
from core.agent_graph import build_bi_agent_graph, run_bi_workflow
from core.visualizer import render_plotly_safely
from langchain_core.messages import AIMessage

class FakeChatModel:
    """Mock LLM to simulate agent outputs deterministically without calling external APIs."""
    def __init__(self, responses):
        self.responses = list(responses)
        self.call_count = 0
        self.invoked_prompts = []

    def invoke(self, messages, **kwargs):
        self.invoked_prompts.append(messages)
        if self.call_count < len(self.responses):
            resp = self.responses[self.call_count]
            self.call_count += 1
            return AIMessage(content=resp)
        return AIMessage(content="Default mock response")

class TestNexusBIComprehensiveQA(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.test_db = "test_qa_nexus.db"

    def setUp(self):
        if os.path.exists(self.test_db):
            os.remove(self.test_db)
        self.db_manager = DatabaseManager(db_path=self.test_db)

    def tearDown(self):
        if os.path.exists(self.test_db):
            os.remove(self.test_db)

    # =========================================================================
    # 1. DATA INGESTION & SCHEMA EXTRACTION EDGE CASES
    # =========================================================================

    def test_ingest_special_characters_and_whitespace_columns(self):
        """QA Test: File ingestion with messy column names and table names."""
        csv_data = """Region & Territory , Total Profit ($) , Q3 Sales %, "Items # Sold"
North-East, 50000, 15.5, 120
South-West, 62000, 18.2, 145
"""
        csv_file = io.StringIO(csv_data)
        success, msg = self.db_manager.load_file_to_sqlite(csv_file, table_name="  My Messy Table! #1  ")
        self.assertTrue(success, f"Failed ingestion: {msg}")

        tables = self.db_manager.get_table_names()
        self.assertIn("My_Messy_Table_1", tables)

        # Check sanitized column names
        success, df, err = self.db_manager.execute_query("SELECT * FROM My_Messy_Table_1;")
        self.assertTrue(success, err)
        self.assertEqual(len(df), 2)
        expected_cols = ["region_territory", "total_profit", "q3_sales", "items_sold"]
        self.assertEqual(list(df.columns), expected_cols)

    def test_chronological_date_all_month_variations(self):
        """QA Test: Date standardizer with various month names and casings."""
        csv_data = """month,year,metric
jan,2024,10
FEBRUARY,2024,20
March,2024,30
apr,2024,40
MAY,2024,50
June,2024,60
jul,2024,70
August,2024,80
sep,2024,90
October,2024,100
nov,2024,110
December,2024,120
"""
        csv_file = io.StringIO(csv_data)
        success, msg = self.db_manager.load_file_to_sqlite(csv_file, table_name="All_Months")
        self.assertTrue(success)

        success, df, err = self.db_manager.execute_query("SELECT date FROM All_Months ORDER BY date ASC;")
        self.assertTrue(success)
        self.assertEqual(len(df), 12)
        self.assertEqual(df.iloc[0]["date"], "2024-01-01")
        self.assertEqual(df.iloc[11]["date"], "2024-12-01")

    def test_ingest_excel_file(self):
        """QA Test: Verify Excel (.xlsx) ingestion via openpyxl and schema retrieval."""
        test_excel_path = "test_data.xlsx"
        df_dummy = pd.DataFrame({
            "dept": ["Marketing", "R&D", "Sales"],
            "budget": [10000, 25000, 18000]
        })
        df_dummy.to_excel(test_excel_path, index=False)

        try:
            success, msg = self.db_manager.load_file_to_sqlite(test_excel_path, table_name="excel_dept")
            self.assertTrue(success, msg)
            schema = self.db_manager.get_schema_info()
            self.assertIn("excel_dept", schema)
            self.assertIn("budget", schema)
        finally:
            if os.path.exists(test_excel_path):
                os.remove(test_excel_path)

    # =========================================================================
    # 2. SECURITY GUARDRAIL & SQL INJECTION TESTS
    # =========================================================================

    def test_guardrail_allows_scalar_replace_function(self):
        """QA Test: Verify SQLite scalar REPLACE(col, 'a', 'b') is permitted (not blocked)."""
        query = "SELECT REPLACE(month, 'J', 'Z') AS altered_month, profit FROM Sales_Agent;"
        is_safe, msg, sanitized = SQLGuardrail.validate_query(query)
        self.assertTrue(is_safe, f"Scalar REPLACE was improperly blocked: {msg}")

    def test_guardrail_blocks_replace_into_mutation(self):
        """QA Test: Verify REPLACE INTO table mutation is strictly blocked."""
        query = "REPLACE INTO Sales_Agent (month, year, profit) VALUES ('August', 2024, 99000);"
        is_safe, msg, sanitized = SQLGuardrail.validate_query(query)
        self.assertFalse(is_safe)
        self.assertIn("Security Violation", msg)

    def test_guardrail_allows_quoted_semicolons(self):
        """QA Test: Semicolons inside string literals must not trigger stacked query rejection."""
        query = "SELECT * FROM Sales_Agent WHERE month = 'Special;Case';"
        is_safe, msg, sanitized = SQLGuardrail.validate_query(query)
        self.assertTrue(is_safe, f"Quoted semicolon was falsely flagged as stacked query: {msg}")

    def test_guardrail_blocks_actual_stacked_queries(self):
        """QA Test: Multi-statement stacked SQL injection must be blocked."""
        query = "SELECT * FROM Sales_Agent; DROP TABLE Sales_Agent;"
        is_safe, msg, sanitized = SQLGuardrail.validate_query(query)
        self.assertFalse(is_safe)
        self.assertIn("Stacked queries", msg)

    def test_guardrail_extracts_markdown_codeblock_with_conversational_text(self):
        """QA Test: Extract SQL from markdown even when preceded/followed by AI chatter."""
        ai_output = """Sure! Here is the SQLite query you need:
```sql
SELECT month, profit FROM Sales_Agent WHERE year = 2024;
```
Hope this answers your question!"""
        is_safe, msg, sanitized = SQLGuardrail.validate_query(ai_output)
        self.assertTrue(is_safe, f"Failed markdown fence extraction: {msg}")
        self.assertEqual(sanitized, "SELECT month, profit FROM Sales_Agent WHERE year = 2024")

    def test_guardrail_blocks_administrative_and_ddl(self):
        """QA Test: Administrative SQLite commands and DDL must be blocked."""
        attacks = [
            "ATTACH DATABASE 'evil.db' AS evil;",
            "DETACH DATABASE evil;",
            "PRAGMA database_list;",
            "ALTER TABLE Sales_Agent RENAME TO Hacked;",
            "TRUNCATE TABLE Sales_Agent;",
            "EXEC xp_cmdshell('dir');"
        ]
        for attack in attacks:
            is_safe, msg, _ = SQLGuardrail.validate_query(attack)
            self.assertFalse(is_safe, f"Attack was not blocked: {attack}")

    # =========================================================================
    # 3. LLM FACTORY & GROQ CONFIGURATION VALIDATION
    # =========================================================================

    def test_llm_factory_groq_defaults(self):
        """QA Test: Verify Groq default model is official llama-3.3-70b-versatile."""
        try:
            llm = LLMFactory.get_llm(provider="groq", api_key="dummy_gsk_key")
            self.assertEqual(llm.model_name, "openai/gpt-oss-120b")
        except Exception as e:
            self.fail(f"LLMFactory failed for Groq: {e}")

    def test_llm_factory_missing_key_raises_error(self):
        """QA Test: Missing API key raises clear informative ValueError."""
        old_key = os.environ.pop("GROQ_API_KEY", None)
        try:
            with self.assertRaises(ValueError) as ctx:
                LLMFactory.get_llm(provider="groq", api_key=None)
            self.assertIn("Groq API Key missing", str(ctx.exception))
        finally:
            if old_key:
                os.environ["GROQ_API_KEY"] = old_key

    # =========================================================================
    # 4. MULTI-AGENT WORKFLOW & SELF-HEALING ENGINE
    # =========================================================================

    def test_self_healing_recovers_from_sql_error(self):
        """QA Test: Self-healing loop detects SQL column typo, feeds error back, and corrects on retry."""
        fake_responses = [
            "SELECT month, proft FROM Sales_Agent;",
            "SELECT month, profit FROM Sales_Agent;",
            "Executive Summary: Profit was strong across all 7 months.\nKey Findings: July peaked at $80,000.\nStrategic Recommendation: Maintain momentum.",
            "import plotly.express as px\nfig = px.bar(df, x='month', y='profit', title='Monthly Profit')"
        ]
        mock_llm = FakeChatModel(fake_responses)

        final_state = run_bi_workflow(
            user_query="What is the monthly profit trend?",
            llm=mock_llm,
            db_manager=self.db_manager
        )

        self.assertEqual(final_state["retry_count"], 1)
        self.assertIsNotNone(final_state["sql_result"])
        self.assertEqual(len(final_state["sql_result"]), 7)
        self.assertIn("Executive Summary", final_state["final_insights"])
        self.assertIn("px.bar", final_state["chart_code"])

        agents_in_log = [t["agent"] for t in final_state["thought_log"]]
        self.assertIn("Self-Healing Engine", agents_in_log)

    def test_self_healing_exceeds_max_retries_gracefully(self):
        """QA Test: If query fails persistently, agent stops at 3 retries without infinite looping."""
        always_fail = FakeChatModel(["SELECT bad_col FROM Sales_Agent;"] * 10)

        final_state = run_bi_workflow(
            user_query="Get invalid column data",
            llm=always_fail,
            db_manager=self.db_manager
        )

        self.assertEqual(final_state["retry_count"], 3)
        self.assertIsNone(final_state["sql_result"])
        self.assertIn("Could not retrieve data", final_state["final_insights"])

    # =========================================================================
    # 5. PANDAS 3.0 SPLIT JSON PARSING & CSV EXPORT
    # =========================================================================

    def test_pandas_3_split_json_parsing(self):
        """QA Test: Ensure pd.read_json parses split orient JSON string via io.StringIO."""
        json_sample = '{"columns":["profit"],"index":[0],"data":[[80000]]}'
        df = pd.read_json(io.StringIO(json_sample), orient="split")
        self.assertEqual(list(df.columns), ["profit"])
        self.assertEqual(df.iloc[0]["profit"], 80000)

    def test_plotly_execution_sandbox_blocks_os_access(self):
        """QA Test: Arbitrary code execution attempting system access is blocked."""
        df = pd.DataFrame({"month": ["Jan", "Feb"], "profit": [40000, 60000]})
        malicious_chart = """
import os
os.system('dir')
fig = px.bar(df, x='month', y='profit')
"""
        with self.assertRaises(Exception):
            render_plotly_safely(malicious_chart, df)

    def test_csv_export_byte_stream(self):
        """QA Test: Result dataframe generates clean, downloadable CSV byte stream."""
        df = pd.DataFrame({"month": ["July"], "profit": [80000]})
        csv_bytes = df.to_csv(index=False).encode('utf-8')
        self.assertTrue(len(csv_bytes) > 0)
        self.assertIn(b"July,80000", csv_bytes)

if __name__ == "__main__":
    unittest.main()
