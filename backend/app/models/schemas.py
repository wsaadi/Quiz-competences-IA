from datetime import datetime
from pydantic import BaseModel, EmailStr, Field


# ── Auth ──────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    username: str
    full_name: str


# ── Users ─────────────────────────────────────────────────────────────
class UserCreate(BaseModel):
    email: EmailStr = Field(...)
    username: str = Field(..., min_length=3, max_length=100)
    full_name: str = Field(..., min_length=1, max_length=200)
    password: str = Field(..., min_length=8)
    role: str = "collaborator"


class UserOut(BaseModel):
    id: int
    email: str
    username: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Evaluation ────────────────────────────────────────────────────────
class ChatMessage(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000)


class ChatResponse(BaseModel):
    response: str
    phase: str
    is_complete: bool
    progress_percent: int


class EvaluationScores(BaseModel):
    score_market_knowledge: float | None = None
    score_terminology: float | None = None
    score_interest_curiosity: float | None = None
    score_personal_watch: float | None = None
    score_technical_level: float | None = None
    score_ai_usage: float | None = None
    score_integration_deployment: float | None = None
    score_conception_dev: float | None = None
    score_global: float | None = None
    detected_level: str | None = None

    model_config = {"from_attributes": True}


class EvaluationOut(BaseModel):
    id: int
    user_id: int
    status: str
    scores: EvaluationScores | None = None
    feedback_collaborator: str | None = None
    feedback_admin: str | None = None
    total_messages: int
    started_at: datetime
    completed_at: datetime | None = None
    detected_level: str | None = None
    job_role: str | None = None
    job_domain: str | None = None

    model_config = {"from_attributes": True}


class EvaluationDetail(EvaluationOut):
    messages: list[dict] = []
    user: UserOut | None = None


class MessageOut(BaseModel):
    id: int
    role: str
    content: str
    phase: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Stats ─────────────────────────────────────────────────────────────
class GlobalStats(BaseModel):
    total_evaluations: int
    completed_evaluations: int
    average_score: float | None
    score_distribution: dict
    level_distribution: dict
    domain_averages: dict
    total_users: int = 0
