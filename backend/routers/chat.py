import io
from datetime import datetime, timezone
from typing import Optional

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, status

from core.agent_graph import run_bi_workflow
from core.llm_factory import LLMFactory
from core.visualizer import render_plotly_safely

from backend.auth import get_current_user
from backend.config import get_settings
from backend.firestore_client import get_firestore_client
from backend.quota import check_quota, increment_usage
from backend.audit import log_query
from backend.schemas.user import CurrentUser
from backend.schemas.chat import ChatRequest, ChatResponse, SessionRename, SessionSummary
from backend.tenancy import get_db_manager_for_user

router = APIRouter(prefix="/api", tags=["chat"])

MAX_RETURNED_ROWS = 500

_PROVIDER_KEYS = {
    "groq": lambda s: s.groq_api_key,
    "gemini": lambda s: s.gemini_api_key,
    "openai": lambda s: s.openai_api_key,
}


def _resolve_server_llm():
    """
    Instantiates the LLM via the existing, unchanged LLMFactory, but sources
    the API key from server-side settings instead of a user-typed sidebar
    value — this is the only behavioral change versus app.py's usage.
    """
    settings = get_settings()
    provider = settings.default_llm_provider
    key_getter = _PROVIDER_KEYS.get(provider)
    api_key = key_getter(settings) if key_getter else None

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Server is not configured with an API key for provider '{provider}'.",
        )

    return LLMFactory.get_llm(provider=provider, api_key=api_key, model_name=settings.default_llm_model)


def _ensure_session(uid: str, session_id: Optional[str], first_message: str) -> str:
    db = get_firestore_client()
    sessions_ref = db.collection("users").document(uid).collection("sessions")
    now = datetime.now(timezone.utc).isoformat()

    if session_id:
        doc = sessions_ref.document(session_id).get()
        if not doc.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")
        sessions_ref.document(session_id).update({"updatedAt": now})
        return session_id

    title = first_message.strip()[:60] or "New conversation"
    new_doc = sessions_ref.document()
    new_doc.set({"title": title, "createdAt": now, "updatedAt": now})
    return new_doc.id


@router.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest, current_user: CurrentUser = Depends(get_current_user)) -> ChatResponse:
    check_quota(current_user)

    db_manager = get_db_manager_for_user(current_user.uid)
    llm = _resolve_server_llm()
    session_id = _ensure_session(current_user.uid, request.session_id, request.message)

    # Unchanged agent workflow call — identical to how app.py invokes it today.
    final_state = run_bi_workflow(
        user_query=request.message,
        llm=llm,
        db_manager=db_manager,
    )

    columns: list[str] = []
    rows: list[dict] = []
    chart_json: Optional[str] = None

    sql_df_json = final_state.get("sql_df_json")
    if sql_df_json:
        try:
            df = pd.read_json(io.StringIO(sql_df_json), orient="split")
            capped_df = df.head(MAX_RETURNED_ROWS).copy()
            # pandas' JSON round-trip coerces purely-numeric column labels (e.g. an
            # unaliased `SELECT 1`) into ints, which breaks the List[str] response
            # schema below — force everything back to str for the API boundary.
            capped_df.columns = [str(c) for c in capped_df.columns]
            columns = list(capped_df.columns)
            rows = capped_df.to_dict(orient="records")

            chart_code = final_state.get("chart_code")
            if chart_code:
                fig = render_plotly_safely(chart_code, df)
                if fig is not None:
                    chart_json = fig.to_json()
        except Exception:
            pass  # Malformed chart/result payload never blocks the text answer.

    guardrail_message = final_state.get("guardrail_message")
    error = final_state.get("error")
    blocked = bool(error and not final_state.get("sql_result"))

    log_query(
        uid=current_user.uid,
        session_id=session_id,
        sql_query=final_state.get("sql_query"),
        guardrail_message=guardrail_message,
        blocked=blocked,
        error=error,
    )
    increment_usage(current_user.uid)

    db = get_firestore_client()
    messages_ref = (
        db.collection("users").document(current_user.uid)
        .collection("sessions").document(session_id)
        .collection("messages")
    )
    now = datetime.now(timezone.utc).isoformat()

    messages_ref.add({"role": "user", "content": request.message, "createdAt": now})
    assistant_doc = messages_ref.document()
    assistant_doc.set({
        "role": "assistant",
        "content": final_state.get("final_insights", ""),
        "sql_query": final_state.get("sql_query"),
        "guardrail_message": guardrail_message,
        "thought_log": final_state.get("thought_log", []),
        "chart_json": chart_json,
        "columns": columns,
        "rows": rows,
        "createdAt": now,
    })

    return ChatResponse(
        session_id=session_id,
        message_id=assistant_doc.id,
        final_insights=final_state.get("final_insights", ""),
        sql_query=final_state.get("sql_query"),
        guardrail_message=guardrail_message,
        thought_log=final_state.get("thought_log", []),
        chart_json=chart_json,
        columns=columns,
        rows=rows,
    )


@router.get("/sessions", response_model=list[SessionSummary])
def list_sessions(current_user: CurrentUser = Depends(get_current_user)):
    db = get_firestore_client()
    docs = (
        db.collection("users").document(current_user.uid)
        .collection("sessions")
        .order_by("updatedAt", direction="DESCENDING")
        .stream()
    )
    return [SessionSummary(id=d.id, **d.to_dict()) for d in docs]


@router.get("/sessions/{session_id}/messages")
def get_session_messages(session_id: str, current_user: CurrentUser = Depends(get_current_user)):
    db = get_firestore_client()
    session_ref = db.collection("users").document(current_user.uid).collection("sessions").document(session_id)
    if not session_ref.get().exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")

    docs = session_ref.collection("messages").order_by("createdAt").stream()
    return [{"id": d.id, **d.to_dict()} for d in docs]


@router.patch("/sessions/{session_id}")
def rename_session(session_id: str, body: SessionRename, current_user: CurrentUser = Depends(get_current_user)):
    db = get_firestore_client()
    session_ref = db.collection("users").document(current_user.uid).collection("sessions").document(session_id)
    if not session_ref.get().exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")
    session_ref.update({"title": body.title})
    return {"ok": True}


@router.delete("/sessions/{session_id}")
def delete_session(session_id: str, current_user: CurrentUser = Depends(get_current_user)):
    db = get_firestore_client()
    session_ref = db.collection("users").document(current_user.uid).collection("sessions").document(session_id)
    if not session_ref.get().exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")

    for msg in session_ref.collection("messages").stream():
        msg.reference.delete()
    session_ref.delete()
    return {"ok": True}
