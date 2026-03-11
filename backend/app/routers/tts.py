"""Text-to-Speech and Speech-to-Text router — ElevenLabs proxy."""

import logging
import re

import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.core.config import settings
from app.models.user import User
from app.routers.deps import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tts", tags=["tts"])

# Shared client for connection reuse (reduces TLS handshake overhead)
_http_client: httpx.AsyncClient | None = None


async def _get_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(connect=5.0, read=30.0, write=10.0, pool=5.0),
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
        )
    return _http_client


class TTSRequest(BaseModel):
    text: str


class TranscriptionResponse(BaseModel):
    text: str


def _clean_for_tts(text: str) -> str:
    """Strip markdown formatting and emojis for cleaner speech."""
    text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)
    text = re.sub(r"\*(.*?)\*", r"\1", text)
    text = re.sub(r"[^\w\s.,;:!?'\"()\-\u2013\u2014/\n]", "", text, flags=re.UNICODE)
    return text.strip()


@router.post("/speak")
async def text_to_speech_stream(
    body: TTSRequest,
    _user: User = Depends(get_current_user),
):
    """Convert text to speech using ElevenLabs streaming API.

    Uses the streaming endpoint for minimal time-to-first-byte and the
    turbo model for faster generation. Audio chunks are forwarded to the
    client as they arrive from ElevenLabs, enabling playback to start
    within ~200-500ms instead of waiting for the full audio (~2-3s).
    """
    if not settings.ELEVENLABS_API_KEY:
        raise HTTPException(
            status_code=501,
            detail="ElevenLabs API key not configured",
        )

    clean_text = _clean_for_tts(body.text)
    if not clean_text:
        raise HTTPException(status_code=400, detail="Texte vide après nettoyage")

    if len(clean_text) > 5000:
        clean_text = clean_text[:5000]

    voice_id = settings.ELEVENLABS_VOICE_ID

    async def audio_stream():
        client = await _get_client()
        try:
            async with client.stream(
                "POST",
                f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream",
                headers={
                    "xi-api-key": settings.ELEVENLABS_API_KEY,
                    "Content-Type": "application/json",
                },
                json={
                    "text": clean_text,
                    "model_id": settings.ELEVENLABS_MODEL,
                    "voice_settings": {
                        "stability": 0.5,
                        "similarity_boost": 0.75,
                        "style": 0.4,
                        "use_speaker_boost": True,
                    },
                    "optimize_streaming_latency": settings.ELEVENLABS_OPTIMIZE_LATENCY,
                },
            ) as response:
                if response.status_code != 200:
                    error_body = await response.aread()
                    logger.error(
                        "ElevenLabs streaming API error %s: %s",
                        response.status_code,
                        error_body[:200],
                    )
                    return
                async for chunk in response.aiter_bytes(4096):
                    yield chunk
        except httpx.TimeoutException:
            logger.error("ElevenLabs streaming timeout")
        except httpx.HTTPError as e:
            logger.error("ElevenLabs streaming connection error: %s", e)

    return StreamingResponse(
        audio_stream(),
        media_type="audio/mpeg",
        headers={
            "Content-Disposition": "inline",
            "Cache-Control": "no-cache",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(
    file: UploadFile = File(...),
    _user: User = Depends(get_current_user),
):
    """Transcribe audio using ElevenLabs Scribe STT.

    Accepts audio files (webm, mp3, wav, ogg, m4a) and returns
    a high-quality French transcription, much better than browser
    Web Speech API for technical terms and acronyms.
    """
    if not settings.ELEVENLABS_API_KEY:
        raise HTTPException(
            status_code=501,
            detail="ElevenLabs API key not configured",
        )

    # Validate file type
    allowed_types = {"audio/webm", "audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "audio/x-m4a"}
    if file.content_type and file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"Type audio non supporté: {file.content_type}")

    # Read audio data (limit to 25MB)
    audio_data = await file.read()
    if len(audio_data) > 25 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Fichier audio trop volumineux (max 25 Mo)")

    client = await _get_client()
    try:
        response = await client.post(
            "https://api.elevenlabs.io/v1/speech-to-text",
            headers={
                "xi-api-key": settings.ELEVENLABS_API_KEY,
            },
            data={
                "model_id": "scribe_v1",
                "language_code": "fra",
            },
            files={
                "file": (file.filename or "audio.webm", audio_data, file.content_type or "audio/webm"),
            },
        )

        if response.status_code != 200:
            logger.error("ElevenLabs STT error %s: %s", response.status_code, response.text[:200])
            raise HTTPException(
                status_code=502,
                detail="Erreur du service de transcription",
            )

        result = response.json()
        return TranscriptionResponse(text=result.get("text", ""))

    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Timeout du service de transcription")
    except httpx.HTTPError as e:
        logger.error("ElevenLabs STT connection error: %s", e)
        raise HTTPException(status_code=502, detail="Erreur de connexion au service de transcription")
