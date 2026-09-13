import unittest
import os
import pandas as pd
from core.database import DatabaseManager
from core.security import SQLGuardrail
from core.models import AgentState

class TestNexusBICore(unittest.TestCase):
    def setUp(self):
        self.test_db = "test_nexus.db"
        self.db_manager = DatabaseManager(db_path=self.test_db)

    def tearDown(self):
        if os.path.exists(self.test_db):
            os.remove(self.test_db)

    def test_database_initialization_and_schema(self):
        """Verify default database preloads Sales_Agent and extracts schema."""
        tables = self.db_manager.get_table_names()
        self.assertIn("Sales_Agent", tables)
        
        schema = self.db_manager.get_schema_info()
        self.assertIn("Sales_Agent", schema)
        self.assertIn("profit", schema)
        self.assertIn("sales", schema)

    def test_chronological_date_fix(self):
        """Verify the month sorting fix adds a valid 'date' column for chronological queries."""
        success, df, err = self.db_manager.execute_query("SELECT date FROM Sales_Agent ORDER BY date ASC LIMIT 1;")
        self.assertTrue(success)
        self.assertIsNotNone(df)
        self.assertEqual(df.iloc[0]["date"], "2024-01-01")

    def test_guardrail_safe_queries(self):
        """Verify valid read-only queries pass guardrail."""
        queries = [
            "SELECT profit FROM Sales_Agent WHERE month = 'July';",
            "SELECT month, AVG(profit) FROM Sales_Agent GROUP BY month;",
            "WITH monthly_avg AS (SELECT AVG(profit) AS avg_p FROM Sales_Agent) SELECT * FROM Sales_Agent, monthly_avg;"
        ]
        for q in queries:
            is_safe, msg, _ = SQLGuardrail.validate_query(q)
            self.assertTrue(is_safe, f"Query should be safe: {q}. Got: {msg}")

    def test_guardrail_blocks_destructive_queries(self):
        """Verify malicious or mutating queries are strictly blocked."""
        dangerous_queries = [
            "DROP TABLE Sales_Agent;",
            "DELETE FROM Sales_Agent WHERE profit < 50000;",
            "UPDATE Sales_Agent SET profit = 0;",
            "INSERT INTO Sales_Agent VALUES ('August', 2024, 100, 10, 90, 99.0);",
            "ALTER TABLE Sales_Agent ADD COLUMN hacked TEXT;",
            "SELECT * FROM Sales_Agent; DROP TABLE Sales_Agent;"
        ]
        for q in dangerous_queries:
            is_safe, msg, _ = SQLGuardrail.validate_query(q)
            self.assertFalse(is_safe, f"Query should be blocked: {q}")

if __name__ == "__main__":
    unittest.main()
