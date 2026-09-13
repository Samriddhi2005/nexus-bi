import json
import re
from typing import Dict, Any, List
from langgraph.graph import StateGraph, END
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.language_models import BaseChatModel
import pandas as pd

from core.models import AgentState
from core.security import SQLGuardrail
from core.database import DatabaseManager

def build_bi_agent_graph(llm: BaseChatModel, db_manager: DatabaseManager):
    """
    Constructs the LangGraph StateGraph with Planner, SQL Engineer, Guardrail,
    Self-Healing DB Executor, Chartist, and Business Insights Narrator.
    """

    # -------------------------------------------------------------
    # Node 1: Planner & SQL Engineer
    # -------------------------------------------------------------
    def generate_sql_node(state: AgentState) -> Dict[str, Any]:
        user_query = state["user_query"]
        schema_info = state["schema_info"]
        previous_error = state.get("error")
        retry_count = state.get("retry_count", 0)
        thought_log = list(state.get("thought_log", []))

        prompt_context = f"""You are an elite SQL Database Engineer.
Your task is to generate a single, highly accurate SQLite SQL query to answer the user's question.

### Database Schema:
{schema_info}

### Rules:
1. Use ONLY valid SQLite syntax.
2. Return ONLY the raw SQL query. Do not wrap in markdown quotes if possible, or use standard ```sql codeblocks.
3. If temporal/month sorting is requested, check if a 'date' column exists (format YYYY-MM-DD) or use calendar ordering instead of alphabetical sorting.
4. ONLY generate read-only SELECT or WITH statements.
"""

        if previous_error and retry_count > 0:
            prompt_context += f"""
### PREVIOUS ATTEMPT FAILED!
Your previous query produced this database error:
ERROR: {previous_error}
Query attempted: {state.get('sql_query')}
Analyze what went wrong (e.g. wrong table name, column name typo, syntax) and FIX it in this new query!
"""
            thought_log.append({
                "agent": "Self-Healing Engine",
                "thought": f"Attempt {retry_count + 1}: Fixing query based on error -> {previous_error}"
            })
        else:
            thought_log.append({
                "agent": "Planner & SQL Engineer",
                "thought": f"Analyzing user question and database schema to generate an optimized SQLite query."
            })

        messages = [
            SystemMessage(content=prompt_context),
            HumanMessage(content=f"User Question: {user_query}")
        ]

        response = llm.invoke(messages)
        raw_sql = response.content.strip()

        # Clean any markdown formatting
        cleaned_sql = SQLGuardrail.clean_query(raw_sql)

        return {
            "sql_query": cleaned_sql,
            "thought_log": thought_log
        }

    # -------------------------------------------------------------
    # Node 2: Security & Guardrail Validator
    # -------------------------------------------------------------
    def guardrail_node(state: AgentState) -> Dict[str, Any]:
        sql_query = state["sql_query"]
        thought_log = list(state.get("thought_log", []))

        is_safe, msg, sanitized_sql = SQLGuardrail.validate_query(sql_query)

        if is_safe:
            thought_log.append({
                "agent": "Security Guardrail",
                "thought": f"Verified SQL query: SAFE (Read-Only SELECT enforced)."
            })
            return {
                "query_valid": True,
                "guardrail_message": msg,
                "sql_query": sanitized_sql,
                "error": None,
                "thought_log": thought_log
            }
        else:
            thought_log.append({
                "agent": "Security Guardrail",
                "thought": f"BLOCKED: {msg}"
            })
            return {
                "query_valid": False,
                "guardrail_message": msg,
                "error": msg,
                "thought_log": thought_log
            }

    # -------------------------------------------------------------
    # Node 3: Database Execution & Self-Healing Observation
    # -------------------------------------------------------------
    def execute_sql_node(state: AgentState) -> Dict[str, Any]:
        thought_log = list(state.get("thought_log", []))
        if not state.get("query_valid", False):
            return {
                "sql_result": None,
                "sql_df_json": None,
                "thought_log": thought_log
            }

        sql_query = state["sql_query"]
        success, df, err = db_manager.execute_query(sql_query)

        if success and df is not None:
            records = df.to_dict(orient="records")
            thought_log.append({
                "agent": "Database Executor",
                "thought": f"Query executed successfully in SQLite. Fetched {len(df)} rows."
            })
            return {
                "sql_result": records,
                "sql_df_json": df.to_json(orient="split"),
                "error": None,
                "thought_log": thought_log
            }
        else:
            retry_count = state.get("retry_count", 0) + 1
            thought_log.append({
                "agent": "Database Executor",
                "thought": f"SQLite execution failed with error: {err}."
            })
            return {
                "sql_result": None,
                "sql_df_json": None,
                "error": err,
                "retry_count": retry_count,
                "thought_log": thought_log
            }

    # -------------------------------------------------------------
    # Node 4: Chartist & Business Insights Narrator
    # -------------------------------------------------------------
    def synthesize_node(state: AgentState) -> Dict[str, Any]:
        user_query = state["user_query"]
        thought_log = list(state.get("thought_log", []))
        error = state.get("error")
        sql_result = state.get("sql_result")
        sql_query = state.get("sql_query")

        # Case 1: Security failure or Unrecoverable DB failure
        if error and not sql_result:
            thought_log.append({
                "agent": "Business Narrator",
                "thought": "Query could not be executed. Generating explanation for user."
            })
            return {
                "final_insights": f"⚠️ **Could not retrieve data:** {error}\n\nPlease rephrase your query or ensure the requested metrics exist in the database.",
                "chart_code": None,
                "thought_log": thought_log
            }

        thought_log.append({
            "agent": "Business Strategist & Visualizer",
            "thought": "Synthesizing raw SQL results into executive insights and Plotly visualization."
        })

        # Generate Business Insights
        insights_prompt = f"""You are a Chief Data Officer & Senior Business Intelligence Analyst.
User Question: "{user_query}"
SQL Query Executed: {sql_query}
Query Result Data:
{json.dumps(sql_result, indent=2) if sql_result else "[]"}

Please provide a clear, professional, and well-structured response containing:
1. **Direct Answer / Executive Summary**: Crisp 1-2 sentences answering the user's question directly with numbers.
2. **Key Findings & Trends**: Bullet points explaining trends, comparisons, or notable patterns.
3. **Strategic Business Recommendation**: 1 practical action item or takeaway for management.

Keep the tone professional, insightful, and concise."""

        response_insights = llm.invoke([
            SystemMessage(content="You are an expert executive business analyst."),
            HumanMessage(content=insights_prompt)
        ])
        final_insights = response_insights.content

        # Generate Plotly Chart Code if appropriate (more than 1 data point or comparison)
        chart_code = None
        if sql_result and len(sql_result) > 1:
            chart_prompt = f"""You are a Python Data Visualization Specialist using Plotly Express.
Given this dataframe structure:
Columns: {list(sql_result[0].keys())}
Sample Data: {json.dumps(sql_result[:5])}
User Query: "{user_query}"

Write Python code using Plotly Express (`px`) that creates a visualization figure stored in the variable `fig`.
Requirements:
1. Assume `df` is already loaded as a pandas DataFrame containing the query results.
2. Choose the most meaningful chart type:
   - Line chart (`px.line`) for trends over time/months.
   - Bar chart (`px.bar`) for comparisons across categories.
   - Scatter plot (`px.scatter`) for correlations.
3. Apply a sleek modern dark template: `fig.update_layout(template="plotly_dark", margin=dict(l=20, r=20, t=40, b=20))`
4. Return ONLY the valid Python code snippet, without any markdown code fence if possible, or within ```python ... ```."""

            chart_resp = llm.invoke([
                SystemMessage(content="You generate ONLY clean executable Python Plotly code using 'df' and saving to 'fig'."),
                HumanMessage(content=chart_prompt)
            ])
            raw_chart = chart_resp.content.strip()
            # Clean markdown fences
            clean_chart = re.sub(r"^```(?:python)?\s*", "", raw_chart, flags=re.IGNORECASE)
            clean_chart = re.sub(r"\s*```$", "", clean_chart).strip()
            chart_code = clean_chart

        return {
            "final_insights": final_insights,
            "chart_code": chart_code,
            "thought_log": thought_log
        }

    # -------------------------------------------------------------
    # Conditional Routing (Self-Healing Loop)
    # -------------------------------------------------------------
    def should_retry(state: AgentState) -> str:
        error = state.get("error")
        retry_count = state.get("retry_count", 0)
        query_valid = state.get("query_valid", False)

        # If there's an execution error, the query was approved by guardrail, and we haven't exceeded 3 retries:
        if error and query_valid and retry_count < 3:
            return "retry_sql"
        return "synthesize"

    # -------------------------------------------------------------
    # Build LangGraph Workflow
    # -------------------------------------------------------------
    workflow = StateGraph(AgentState)

    workflow.add_node("generate_sql", generate_sql_node)
    workflow.add_node("guardrail", guardrail_node)
    workflow.add_node("execute_sql", execute_sql_node)
    workflow.add_node("synthesize", synthesize_node)

    # Edges
    workflow.set_entry_point("generate_sql")
    workflow.add_edge("generate_sql", "guardrail")

    # From Guardrail: if invalid, go to synthesize (error report), else execute
    def check_guardrail(state: AgentState) -> str:
        return "execute_sql" if state.get("query_valid", False) else "synthesize"

    workflow.add_conditional_edges("guardrail", check_guardrail, {
        "execute_sql": "execute_sql",
        "synthesize": "synthesize"
    })

    # From Execute SQL: check if retry/self-heal needed
    workflow.add_conditional_edges("execute_sql", should_retry, {
        "retry_sql": "generate_sql",
        "synthesize": "synthesize"
    })

    workflow.add_edge("synthesize", END)

    return workflow.compile()

def run_bi_workflow(
    user_query: str,
    llm: BaseChatModel,
    db_manager: DatabaseManager
) -> Dict[str, Any]:
    """
    Executes the full Multi-Agent BI workflow for a user question.
    """
    app = build_bi_agent_graph(llm, db_manager)
    schema_info = db_manager.get_schema_info()

    initial_state: AgentState = {
        "user_query": user_query,
        "schema_info": schema_info,
        "sql_query": "",
        "query_valid": False,
        "guardrail_message": "",
        "sql_result": None,
        "sql_df_json": None,
        "error": None,
        "retry_count": 0,
        "thought_log": [],
        "chart_code": None,
        "final_insights": ""
    }

    final_state = app.invoke(initial_state)
    return final_state
