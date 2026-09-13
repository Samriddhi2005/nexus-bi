from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    session_id: str
    message_id: str
    final_insights: str
    sql_query: Optional[str] = None
    guardrail_message: Optional[str] = None
    thought_log: List[Dict[str, Any]] = []
    chart_json: Optional[str] = None
    columns: List[str] = []
    rows: List[Dict[str, Any]] = []


class SessionSummary(BaseModel):
    id: str
    title: str
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


class SessionRename(BaseModel):
    title: str
