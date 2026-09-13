from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from google.cloud.firestore_v1 import Increment

from backend.firestore_client import get_firestore_client
from backend.schemas.user import CurrentUser


def _next_midnight_utc() -> str:
    now = datetime.now(timezone.utc)
    tomorrow = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return tomorrow.isoformat()


def _is_expired(reset_at: str | None) -> bool:
    if not reset_at:
        return True
    return datetime.now(timezone.utc) >= datetime.fromisoformat(reset_at)


def check_quota(current_user: CurrentUser) -> None:
    """
    Lazily resets the caller's daily counter if it has rolled over, then
    rejects the request with 429 if they're already at their daily limit.
    No cron job needed: the reset happens on the next request after expiry.
    """
    db = get_firestore_client()
    user_ref = db.collection("users").document(current_user.uid)

    if _is_expired(current_user.quota.resetAt):
        user_ref.update({
            "quota.used": 0,
            "quota.resetAt": _next_midnight_utc(),
        })
        return  # freshly reset, definitely under quota

    if current_user.quota.used >= current_user.quota.dailyLimit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Daily query quota ({current_user.quota.dailyLimit}) reached. Try again after reset.",
        )


def increment_usage(uid: str, field: str = "quota.used") -> None:
    db = get_firestore_client()
    db.collection("users").document(uid).update({field: Increment(1)})
