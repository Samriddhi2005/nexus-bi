from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from backend.auth import require_admin
from backend.firestore_client import get_firestore_client
from backend.schemas.admin import AdminUserSummary, AuditLogEntry, OverviewStats, UserPatch
from backend.schemas.user import CurrentUser

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/overview", response_model=OverviewStats)
def overview(_: CurrentUser = Depends(require_admin)):
    db = get_firestore_client()

    total_users = db.collection("users").count().get()[0][0].value

    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    week_start_str = (datetime.now(timezone.utc) - timedelta(days=6)).strftime("%Y-%m-%d")

    today_docs = list(db.collection("usage_daily").where("date", "==", today_str).stream())
    week_docs = list(db.collection("usage_daily").where("date", ">=", week_start_str).stream())

    queries_today = sum(d.to_dict().get("queries", 0) for d in today_docs)
    guardrail_blocks_today = sum(d.to_dict().get("guardrailBlocks", 0) for d in today_docs)
    errors_today = sum(d.to_dict().get("errors", 0) for d in today_docs)
    queries_7d = sum(d.to_dict().get("queries", 0) for d in week_docs)

    return OverviewStats(
        totalUsers=total_users,
        queriesToday=queries_today,
        queries7d=queries_7d,
        guardrailBlocksToday=guardrail_blocks_today,
        errorsToday=errors_today,
    )


@router.get("/users", response_model=list[AdminUserSummary])
def list_users(_: CurrentUser = Depends(require_admin)):
    db = get_firestore_client()
    summaries = []
    for doc in db.collection("users").stream():
        data = doc.to_dict()
        quota = data.get("quota") or {}
        summaries.append(AdminUserSummary(
            uid=doc.id,
            email=data.get("email"),
            displayName=data.get("displayName"),
            role=data.get("role", "user"),
            plan=data.get("plan", "free"),
            quotaUsed=quota.get("used", 0),
            quotaLimit=quota.get("dailyLimit", 0),
        ))
    return summaries


@router.patch("/users/{uid}")
def patch_user(uid: str, body: UserPatch, _: CurrentUser = Depends(require_admin)):
    db = get_firestore_client()
    doc_ref = db.collection("users").document(uid)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    updates = {}
    if body.role is not None:
        updates["role"] = body.role
    if body.plan is not None:
        updates["plan"] = body.plan
    if body.dailyLimit is not None:
        updates["quota.dailyLimit"] = body.dailyLimit

    if updates:
        doc_ref.update(updates)
    return {"ok": True}


@router.get("/audit-log", response_model=list[AuditLogEntry])
def audit_log(
    uid: Optional[str] = Query(default=None),
    blocked_only: bool = Query(default=False),
    limit: int = Query(default=50, le=200),
    _: CurrentUser = Depends(require_admin),
):
    db = get_firestore_client()
    query = db.collection("audit_logs")

    if uid:
        query = query.where("uid", "==", uid)
    if blocked_only:
        query = query.where("blocked", "==", True)

    query = query.order_by("timestamp", direction="DESCENDING").limit(limit)
    return [AuditLogEntry(id=d.id, **d.to_dict()) for d in query.stream()]
