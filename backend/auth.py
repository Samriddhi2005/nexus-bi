import logging
from datetime import datetime, timezone

from fastapi import Depends, Header, HTTPException, status
from firebase_admin import auth as firebase_auth

logger = logging.getLogger("nexusbi.auth")

from backend.config import get_settings
from backend.firestore_client import get_firestore_client
from backend.schemas.user import CurrentUser, Quota


def _default_quota() -> dict:
    settings = get_settings()
    return {"dailyLimit": settings.daily_query_quota_free, "used": 0, "resetAt": None}


def _load_or_create_user_doc(uid: str, email: str | None, display_name: str | None) -> dict:
    """
    Fetches the users/{uid} Firestore doc, creating it with sane defaults on first login.
    This is the only place a new user record is minted.
    """
    db = get_firestore_client()
    doc_ref = db.collection("users").document(uid)
    snapshot = doc_ref.get()

    if snapshot.exists:
        return snapshot.to_dict()

    new_user = {
        "email": email,
        "displayName": display_name,
        "role": "user",
        "plan": "free",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "quota": _default_quota(),
    }
    doc_ref.set(new_user)
    return new_user


async def get_current_user(authorization: str = Header(default="")) -> CurrentUser:
    """
    FastAPI dependency: verifies the Firebase ID token sent by the Next.js
    frontend and returns the caller's app-level identity + quota state.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token.")

    id_token = authorization.removeprefix("Bearer ").strip()

    try:
        decoded = firebase_auth.verify_id_token(id_token)
    except Exception as exc:
        # The client only ever sees a generic 401 — the real reason (expired,
        # clock skew, wrong project audience, malformed token, ...) is logged
        # server-side only, since it can be diagnostically useful but isn't
        # something to hand back over the wire.
        logger.warning("Firebase ID token rejected: %s: %s", type(exc).__name__, exc)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token.")

    uid = decoded["uid"]
    email = decoded.get("email")
    display_name = decoded.get("name")

    user_doc = _load_or_create_user_doc(uid, email, display_name)
    quota_doc = user_doc.get("quota") or _default_quota()

    return CurrentUser(
        uid=uid,
        email=user_doc.get("email") or email,
        display_name=user_doc.get("displayName") or display_name,
        role=user_doc.get("role", "user"),
        plan=user_doc.get("plan", "free"),
        quota=Quota(**quota_doc),
    )


async def require_admin(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required.")
    return current_user
