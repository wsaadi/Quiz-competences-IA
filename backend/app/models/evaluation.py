import enum
from datetime import datetime, timezone

from sqlalchemy import (
    String, Text, DateTime, Enum, Integer, Float, ForeignKey, JSON,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class EvaluationStatus(str, enum.Enum):
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


class Evaluation(Base):
    __tablename__ = "evaluations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    status: Mapped[EvaluationStatus] = mapped_column(
        Enum(EvaluationStatus), default=EvaluationStatus.IN_PROGRESS
    )

    # Scores by domain (0-100)
    score_market_knowledge: Mapped[float | None] = mapped_column(Float, nullable=True)
    score_terminology: Mapped[float | None] = mapped_column(Float, nullable=True)
    score_interest_curiosity: Mapped[float | None] = mapped_column(Float, nullable=True)
    score_personal_watch: Mapped[float | None] = mapped_column(Float, nullable=True)
    score_technical_level: Mapped[float | None] = mapped_column(Float, nullable=True)
    score_ai_usage: Mapped[float | None] = mapped_column(Float, nullable=True)
    score_integration_deployment: Mapped[float | None] = mapped_column(Float, nullable=True)
    score_conception_dev: Mapped[float | None] = mapped_column(Float, nullable=True)
    score_global: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Detected level
    detected_level: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Feedback
    feedback_collaborator: Mapped[str | None] = mapped_column(Text, nullable=True)
    feedback_admin: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Metadata
    total_messages: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Conversation stored as JSON
    conversation_history: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    user = relationship("User", back_populates="evaluations")
    messages = relationship("EvaluationMessage", back_populates="evaluation", lazy="selectin")


class EvaluationMessage(Base):
    __tablename__ = "evaluation_messages"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    evaluation_id: Mapped[int] = mapped_column(ForeignKey("evaluations.id"), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # "user" or "assistant"
    content: Mapped[str] = mapped_column(Text, nullable=False)
    phase: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    evaluation = relationship("Evaluation", back_populates="messages")
