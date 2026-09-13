from datetime import datetime, timezone

from google.cloud.firestore_v1 import Increment

from backend.firestore_client import get_firestore_client


def log_query(
    uid: str,
    session_id: str | None,
    sql_query: str | None,
    guardrail_message: str | None,
    blocked: bool,
    error: str | None = None,
) -> None:
    """
    Writes one audit_logs entry per chat request (regardless of outcome) and
    bumps the cheap usage_daily counters that power the admin dashboard
    without needing heavy aggregation queries at read time.
    """
    db = get_firestore_client()
    now = datetime.now(timezone.utc)

    db.collection("audit_logs").add({
        "uid": uid,
        "sessionId": session_id,
        "sqlQuery": sql_query,
        "guardrailVerdict": guardrail_message,
        "blocked": blocked,
        "error": error,
        "timestamp": now.isoformat(),
    })

    day_key = f"{uid}_{now.strftime('%Y%m%d')}"
    updates = {"uid": uid, "date": now.strftime("%Y-%m-%d"), "queries": Increment(1)}
    if blocked:
        updates["guardrailBlocks"] = Increment(1)
    if error:
        updates["errors"] = Increment(1)

    db.collection("usage_daily").document(day_key).set(updates, merge=True)
