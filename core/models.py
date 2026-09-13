from typing import TypedDict, List, Dict, Any, Optional
from pydantic import BaseModel, Field

class ThoughtStep(BaseModel):
    agent: str = Field(description="Name of the sub-agent or step, e.g., Planner, SQL Engineer, Guardrail")
    thought: str = Field(description="Internal thought or observation")
    status: str = Field(default="completed", description="Status: in_progress, completed, error")

class AgentState(TypedDict):
    user_query: str
    schema_info: str
    sql_query: str
    query_valid: bool
    guardrail_message: str
    sql_result: Optional[List[Dict[str, Any]]]
    sql_df_json: Optional[str]
    error: Optional[str]
    retry_count: int
    thought_log: List[Dict[str, str]]
    chart_code: Optional[str]
    final_insights: str
