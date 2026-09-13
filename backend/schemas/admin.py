from typing import List, Optional

from pydantic import BaseModel


class OverviewStats(BaseModel):
    totalUsers: int
    queriesToday: int
    queries7d: int
    guardrailBlocksToday: int
    errorsToday: int


class AdminUserSummary(BaseModel):
    uid: str
    email: Optional[str] = None
    displayName: Optional[str] = None
    role: str
    plan: str
    quotaUsed: int
    quotaLimit: int


class UserPatch(BaseModel):
    role: Optional[str] = None
    plan: Optional[str] = None
    dailyLimit: Optional[int] = None


class AuditLogEntry(BaseModel):
    id: str
    uid: str
    sessionId: Optional[str] = None
    sqlQuery: Optional[str] = None
    guardrailVerdict: Optional[str] = None
    blocked: bool
    error: Optional[str] = None
    timestamp: str
