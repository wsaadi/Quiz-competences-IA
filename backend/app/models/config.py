"""Application configuration and API usage tracking models."""

from datetime import datetime, timezone

from sqlalchemy import String, Text, DateTime, Float, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AppConfig(Base):
    """Key-value store for app settings (branding, voice, etc.)."""
    __tablename__ = "app_config"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False, default="")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class ApiUsageLog(Base):
    """Tracks every API call to Mistral and ElevenLabs."""
    __tablename__ = "api_usage_logs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    service: Mapped[str] = mapped_column(String(50), nullable=False)  # "mistral" or "elevenlabs"
    endpoint: Mapped[str] = mapped_column(String(100), nullable=False)  # "chat", "tts", "stt", "stt-token"
    evaluation_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Mistral token counts
    tokens_in: Mapped[int] = mapped_column(Integer, default=0)
    tokens_out: Mapped[int] = mapped_column(Integer, default=0)

    # ElevenLabs character count
    characters: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class CostConfig(Base):
    """Cost rates for API usage (admin-configurable)."""
    __tablename__ = "cost_config"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    label: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
