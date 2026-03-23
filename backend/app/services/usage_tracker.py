"""Utility for logging API usage to the database."""

import logging
from app.core.database import async_session
from app.models.config import ApiUsageLog

logger = logging.getLogger(__name__)


async def log_api_usage(
    service: str,
    endpoint: str,
    tokens_in: int = 0,
    tokens_out: int = 0,
    characters: int = 0,
    evaluation_id: int | None = None,
    user_id: int | None = None,
):
    """Fire-and-forget usage logging."""
    try:
        async with async_session() as session:
            session.add(ApiUsageLog(
                service=service,
                endpoint=endpoint,
                tokens_in=tokens_in,
                tokens_out=tokens_out,
                characters=characters,
                evaluation_id=evaluation_id,
                user_id=user_id,
            ))
            await session.commit()
    except Exception as exc:
        logger.warning("Failed to log API usage: %s", exc)
