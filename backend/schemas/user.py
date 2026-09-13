from typing import Literal, Optional

from pydantic import BaseModel


class Quota(BaseModel):
    dailyLimit: int
    used: int = 0
    resetAt: Optional[str] = None  # ISO timestamp; naive lazy-reset, no cron needed


class CurrentUser(BaseModel):
    uid: str
    email: Optional[str] = None
    display_name: Optional[str] = None
    role: Literal["user", "admin"] = "user"
    plan: Literal["free", "pro"] = "free"
    quota: Quota
