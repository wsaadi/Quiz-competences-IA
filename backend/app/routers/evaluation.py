"""Evaluation router — handles chat sessions and evaluation lifecycle."""

import json
from datetime import datetime, timezone

import bleach
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db, async_session
from app.services.content_guard import (
    moderate_message,
    pseudonymize_message,
    depseudonymize_response,
    BLOCKED_RESPONSE,
    OFF_TOPIC_RESPONSE,
)
from app.models.evaluation import Evaluation, EvaluationMessage, EvaluationStatus
from app.models.schemas import ChatMessage, ChatResponse, EvaluationOut, EvaluationScores, MessageOut
from app.models.user import User
from app.routers.deps import get_current_user
from app.services.mistral_service import (
    evaluate_message,
    generate_final_scoring,
    stream_mistral,
    split_into_sentences,
    parse_eval_meta,
    get_last_stream_usage,
    SYSTEM_PROMPT,
)
from app.services.usage_tracker import log_api_usage

router = APIRouter(prefix="/evaluations", tags=["evaluations"])

MAX_MESSAGES_PER_EVAL = 60  # ~30 min with ~30s per exchange


def _build_conversation(messages: list[EvaluationMessage]) -> list[dict]:
    return [{"role": m.role, "content": m.content} for m in messages]


def _sanitize(text: str) -> str:
    return bleach.clean(text, strip=True)


def _scores_from_eval(ev: Evaluation) -> EvaluationScores:
    return EvaluationScores(
        score_market_knowledge=ev.score_market_knowledge,
        score_terminology=ev.score_terminology,
        score_interest_curiosity=ev.score_interest_curiosity,
        score_personal_watch=ev.score_personal_watch,
        score_technical_level=ev.score_technical_level,
        score_ai_usage=ev.score_ai_usage,
        score_integration_deployment=ev.score_integration_deployment,
        score_conception_dev=ev.score_conception_dev,
        score_global=ev.score_global,
        detected_level=ev.detected_level,
    )



@router.post("/start", response_model=ChatResponse)
async def start_evaluation(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Start a new evaluation session. If one is already in-progress, return a conflict hint so the frontend can resume it."""
    # Check if there's already an in-progress evaluation
    result = await db.execute(
        select(Evaluation).where(
            Evaluation.user_id == user.id,
            Evaluation.status == EvaluationStatus.IN_PROGRESS,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Une évaluation est déjà en cours. Termine-la d'abord !",
        )

    # Create evaluation
    evaluation = Evaluation(user_id=user.id, total_messages=0)
    db.add(evaluation)
    await db.flush()

    # Get initial greeting from AI
    initial_context = (
        f"Le collaborateur s'appelle {user.full_name}. "
        "Commence l'évaluation en te présentant chaleureusement."
    )
    ai_response, meta, usage = await evaluate_message([], initial_context)

    # Log Mistral usage
    await log_api_usage(
        service="mistral", endpoint="chat",
        tokens_in=usage.get("prompt_tokens", 0),
        tokens_out=usage.get("completion_tokens", 0),
        evaluation_id=evaluation.id, user_id=user.id,
    )

    # Save AI message
    ai_msg = EvaluationMessage(
        evaluation_id=evaluation.id,
        role="assistant",
        content=ai_response,
        phase=meta.get("phase", "ACCUEIL") if meta else "ACCUEIL",
    )
    db.add(ai_msg)
    evaluation.total_messages = 1
    await db.flush()

    return ChatResponse(
        response=ai_response,
        phase=meta.get("phase", "ACCUEIL") if meta else "ACCUEIL",
        is_complete=False,
        progress_percent=meta.get("progress", 5) if meta else 5,
    )


@router.post("/{evaluation_id}/chat", response_model=ChatResponse)
async def chat(
    evaluation_id: int,
    body: ChatMessage,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Send a message in an active evaluation."""
    result = await db.execute(
        select(Evaluation).where(
            Evaluation.id == evaluation_id,
            Evaluation.user_id == user.id,
        )
    )
    evaluation = result.scalar_one_or_none()
    if not evaluation:
        raise HTTPException(status_code=404, detail="Évaluation introuvable")
    if evaluation.status != EvaluationStatus.IN_PROGRESS:
        raise HTTPException(status_code=400, detail="Cette évaluation est déjà terminée")

    # Sanitize user input
    clean_message = _sanitize(body.message)

    # ── Content moderation ──
    moderation = await moderate_message(clean_message)
    if moderation["status"] in ("blocked", "off_topic"):
        canned = BLOCKED_RESPONSE if moderation["status"] == "blocked" else OFF_TOPIC_RESPONSE
        # Save both messages (user + canned AI response)
        db.add(EvaluationMessage(evaluation_id=evaluation.id, role="user", content=clean_message))
        db.add(EvaluationMessage(evaluation_id=evaluation.id, role="assistant", content=canned, phase="MODERATION"))
        evaluation.total_messages += 2
        await db.commit()
        return ChatResponse(
            response=canned,
            phase="MODERATION",
            is_complete=False,
            progress_percent=0,
        )

    # ── Pseudonymize before sending to Mistral ──
    pseudonymized_message, pii_replacements = await pseudonymize_message(clean_message)

    # Save user message (original, not pseudonymized)
    user_msg = EvaluationMessage(
        evaluation_id=evaluation.id,
        role="user",
        content=clean_message,
    )
    db.add(user_msg)
    await db.flush()

    # Reload messages for conversation context
    msg_result = await db.execute(
        select(EvaluationMessage)
        .where(EvaluationMessage.evaluation_id == evaluation.id)
        .order_by(EvaluationMessage.created_at)
    )
    all_messages = msg_result.scalars().all()
    conversation = _build_conversation(all_messages)

    # If pseudonymized, replace last user message in conversation for Mistral
    if pii_replacements:
        conversation[-1] = {"role": "user", "content": pseudonymized_message}

    # Check if we should wrap up
    should_conclude = evaluation.total_messages >= MAX_MESSAGES_PER_EVAL - 4

    if should_conclude:
        ai_response, meta, usage = await generate_final_scoring(conversation)
    else:
        ai_response, meta, usage = await evaluate_message(conversation[:-1], pseudonymized_message)

    # De-pseudonymize AI response so user sees real names
    ai_response = depseudonymize_response(ai_response, pii_replacements)

    # Log Mistral usage
    await log_api_usage(
        service="mistral", endpoint="chat",
        tokens_in=usage.get("prompt_tokens", 0),
        tokens_out=usage.get("completion_tokens", 0),
        evaluation_id=evaluation.id, user_id=user.id,
    )

    # Save AI message
    phase = meta.get("phase", "EXPLORATION") if meta else "EXPLORATION"
    ai_msg = EvaluationMessage(
        evaluation_id=evaluation.id,
        role="assistant",
        content=ai_response,
        phase=phase,
    )
    db.add(ai_msg)
    evaluation.total_messages += 2

    # Persist job context from metadata as soon as available
    if meta:
        if meta.get("job_role") and not evaluation.job_role:
            evaluation.job_role = meta["job_role"]
        if meta.get("job_domain") and not evaluation.job_domain:
            evaluation.job_domain = meta["job_domain"]

    # If scoring phase, save final scores
    is_complete = False
    if meta and meta.get("phase") == "SCORING":
        scores = meta.get("scores", {})
        evaluation.score_market_knowledge = scores.get("market_knowledge")
        evaluation.score_terminology = scores.get("terminology")
        evaluation.score_interest_curiosity = scores.get("interest_curiosity")
        evaluation.score_personal_watch = scores.get("personal_watch")
        evaluation.score_technical_level = scores.get("technical_level")
        evaluation.score_ai_usage = scores.get("ai_usage")
        evaluation.score_integration_deployment = scores.get("integration_deployment")
        evaluation.score_conception_dev = scores.get("conception_dev")

        all_scores = [v for v in scores.values() if isinstance(v, (int, float))]
        evaluation.score_global = round(sum(all_scores) / len(all_scores), 1) if all_scores else 0

        evaluation.detected_level = meta.get("detected_level", "intermediaire")
        evaluation.feedback_collaborator = meta.get("feedback_collaborator", "")
        _fa = meta.get("feedback_admin", "")
        evaluation.feedback_admin = json.dumps(_fa, ensure_ascii=False) if isinstance(_fa, dict) else _fa
        if meta.get("job_role"):
            evaluation.job_role = meta["job_role"]
        if meta.get("job_domain"):
            evaluation.job_domain = meta["job_domain"]
        evaluation.status = EvaluationStatus.COMPLETED
        evaluation.completed_at = datetime.now(timezone.utc)
        is_complete = True

    await db.flush()

    return ChatResponse(
        response=ai_response,
        phase=phase,
        is_complete=is_complete,
        progress_percent=meta.get("progress", 50) if meta else 50,
    )


@router.post("/{evaluation_id}/chat-stream")
async def chat_stream(
    evaluation_id: int,
    body: ChatMessage,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Streaming chat endpoint — returns SSE with sentence-by-sentence text chunks.

    Each sentence is emitted as soon as Mistral produces it, enabling the frontend
    to start ElevenLabs TTS immediately without waiting for the full AI response.
    Final event contains metadata (phase, progress, scores) and the full response text.
    """
    result = await db.execute(
        select(Evaluation).where(
            Evaluation.id == evaluation_id,
            Evaluation.user_id == user.id,
        )
    )
    evaluation = result.scalar_one_or_none()
    if not evaluation:
        raise HTTPException(status_code=404, detail="Évaluation introuvable")
    if evaluation.status != EvaluationStatus.IN_PROGRESS:
        raise HTTPException(status_code=400, detail="Cette évaluation est déjà terminée")

    clean_message = _sanitize(body.message)

    # ── Content moderation ──
    moderation = await moderate_message(clean_message)
    if moderation["status"] in ("blocked", "off_topic"):
        canned = BLOCKED_RESPONSE if moderation["status"] == "blocked" else OFF_TOPIC_RESPONSE
        db.add(EvaluationMessage(evaluation_id=evaluation.id, role="user", content=clean_message))
        db.add(EvaluationMessage(evaluation_id=evaluation.id, role="assistant", content=canned, phase="MODERATION"))
        evaluation.total_messages += 2
        await db.commit()

        async def _moderation_stream():
            yield f"data: {json.dumps({'type': 'sentence', 'text': canned})}\n\n"
            yield f"data: {json.dumps({'type': 'done', 'full_text': canned, 'meta': {'phase': 'MODERATION', 'progress': 0}})}\n\n"

        return StreamingResponse(_moderation_stream(), media_type="text/event-stream")

    # ── Pseudonymize before sending to Mistral ──
    pseudonymized_message, pii_replacements = await pseudonymize_message(clean_message)

    # Save user message (original, not pseudonymized)
    user_msg = EvaluationMessage(
        evaluation_id=evaluation.id,
        role="user",
        content=clean_message,
    )
    db.add(user_msg)
    await db.flush()

    # Load conversation context
    msg_result = await db.execute(
        select(EvaluationMessage)
        .where(EvaluationMessage.evaluation_id == evaluation.id)
        .order_by(EvaluationMessage.created_at)
    )
    all_messages = msg_result.scalars().all()
    conversation = _build_conversation(all_messages)

    # If pseudonymized, replace last user message in conversation for Mistral
    if pii_replacements:
        conversation[-1] = {"role": "user", "content": pseudonymized_message}

    should_conclude = evaluation.total_messages >= MAX_MESSAGES_PER_EVAL - 4

    # Build Mistral messages
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    if should_conclude:
        messages.extend(conversation)
        messages.append({
            "role": "user",
            "content": (
                "L'évaluation est maintenant terminée. Génère le scoring final avec la phase SCORING. "
                "Évalue chaque domaine de 0 à 100 en te basant sur TOUTE la conversation et en appliquant la GRILLE DE NOTATION STRICTE. "
                "RAPPEL : connaître quelques termes = score 35-45 maximum. "
                "Rédige un feedback_collaborator encourageant (3-5 phrases, texte simple). "
                "Rédige un feedback_admin STRUCTURÉ en objet JSON conforme au format défini dans le system prompt "
                "(synthese, domaines avec constats/points_forts/lacunes/recommandations, points_forts_globaux, axes_amelioration, plan_action). "
                "Détermine le detected_level. Inclus job_role et job_domain."
            ),
        })
    else:
        messages.extend(conversation[:-1])
        messages.append({"role": "user", "content": pseudonymized_message})

    # Capture evaluation data for the streaming generator
    eval_id = evaluation.id
    eval_total_messages = evaluation.total_messages
    eval_job_role = evaluation.job_role
    eval_job_domain = evaluation.job_domain
    _pii_map = pii_replacements  # capture for closure

    async def event_stream():
        full_response = ""
        sentence_buffer = ""
        sentence_index = 0
        inside_meta = False  # Track whether we're inside <eval_meta> block

        async for chunk in stream_mistral(messages):
            full_response += chunk
            sentence_buffer += chunk

            # If we encounter <eval_meta>, stop emitting sentences
            if "<eval_meta" in sentence_buffer:
                inside_meta = True
                # Emit anything before the tag
                before_tag = sentence_buffer[:sentence_buffer.find("<eval_meta")]
                if before_tag.strip():
                    completed, leftover = split_into_sentences(before_tag)
                    for sentence in completed:
                        out = depseudonymize_response(sentence, _pii_map)
                        event_data = json.dumps({"text": out, "index": sentence_index}, ensure_ascii=False)
                        yield f"event: sentence\ndata: {event_data}\n\n"
                        sentence_index += 1
                    if leftover.strip():
                        out = depseudonymize_response(leftover.strip(), _pii_map)
                        event_data = json.dumps({"text": out, "index": sentence_index}, ensure_ascii=False)
                        yield f"event: sentence\ndata: {event_data}\n\n"
                        sentence_index += 1
                sentence_buffer = ""
                continue

            if inside_meta:
                # Swallow everything inside the meta block
                sentence_buffer = ""
                continue

            # Normal path: split at sentence boundaries and emit
            completed, sentence_buffer = split_into_sentences(sentence_buffer)
            for sentence in completed:
                out = depseudonymize_response(sentence, _pii_map)
                event_data = json.dumps({"text": out, "index": sentence_index}, ensure_ascii=False)
                yield f"event: sentence\ndata: {event_data}\n\n"
                sentence_index += 1

        # Emit remaining buffer (only if not inside meta block)
        if not inside_meta and sentence_buffer.strip():
            out = depseudonymize_response(sentence_buffer.strip(), _pii_map)
            event_data = json.dumps({"text": out, "index": sentence_index}, ensure_ascii=False)
            yield f"event: sentence\ndata: {event_data}\n\n"

        # Parse metadata from full response
        meta, clean_ai_message = parse_eval_meta(full_response)
        clean_ai_message = depseudonymize_response(clean_ai_message, _pii_map)
        phase = meta.get("phase", "EXPLORATION") if meta else "EXPLORATION"
        is_complete = bool(meta and meta.get("phase") == "SCORING")

        # Log Mistral streaming usage
        stream_usage = get_last_stream_usage()
        await log_api_usage(
            service="mistral", endpoint="chat-stream",
            tokens_in=stream_usage.get("prompt_tokens", 0),
            tokens_out=stream_usage.get("completion_tokens", 0),
            evaluation_id=eval_id, user_id=user.id,
        )

        # Save to DB in a new session (the original session is closed)
        async with async_session() as save_db:
            ai_msg = EvaluationMessage(
                evaluation_id=eval_id,
                role="assistant",
                content=clean_ai_message,
                phase=phase,
            )
            save_db.add(ai_msg)

            ev_result = await save_db.execute(
                select(Evaluation).where(Evaluation.id == eval_id)
            )
            ev = ev_result.scalar_one()
            ev.total_messages = eval_total_messages + 2

            if meta:
                if meta.get("job_role") and not eval_job_role:
                    ev.job_role = meta["job_role"]
                if meta.get("job_domain") and not eval_job_domain:
                    ev.job_domain = meta["job_domain"]

            if is_complete and meta:
                scores = meta.get("scores", {})
                ev.score_market_knowledge = scores.get("market_knowledge")
                ev.score_terminology = scores.get("terminology")
                ev.score_interest_curiosity = scores.get("interest_curiosity")
                ev.score_personal_watch = scores.get("personal_watch")
                ev.score_technical_level = scores.get("technical_level")
                ev.score_ai_usage = scores.get("ai_usage")
                ev.score_integration_deployment = scores.get("integration_deployment")
                ev.score_conception_dev = scores.get("conception_dev")
                all_scores = [v for v in scores.values() if isinstance(v, (int, float))]
                ev.score_global = round(sum(all_scores) / len(all_scores), 1) if all_scores else 0
                ev.detected_level = meta.get("detected_level", "intermediaire")
                ev.feedback_collaborator = meta.get("feedback_collaborator", "")
                _fa = meta.get("feedback_admin", "")
                ev.feedback_admin = json.dumps(_fa, ensure_ascii=False) if isinstance(_fa, dict) else _fa
                if meta.get("job_role"):
                    ev.job_role = meta["job_role"]
                if meta.get("job_domain"):
                    ev.job_domain = meta["job_domain"]
                ev.status = EvaluationStatus.COMPLETED
                ev.completed_at = datetime.now(timezone.utc)

            await save_db.commit()

        # Final event with full response and metadata
        final_data = json.dumps({
            "response": clean_ai_message,
            "phase": phase,
            "is_complete": is_complete,
            "progress_percent": meta.get("progress", 50) if meta else 50,
        }, ensure_ascii=False)
        yield f"event: done\ndata: {final_data}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/{evaluation_id}/complete", response_model=EvaluationOut)
async def force_complete(
    evaluation_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Force-complete an evaluation and generate scoring."""
    result = await db.execute(
        select(Evaluation).where(
            Evaluation.id == evaluation_id,
            Evaluation.user_id == user.id,
        )
    )
    evaluation = result.scalar_one_or_none()
    if not evaluation:
        raise HTTPException(status_code=404, detail="Évaluation introuvable")
    if evaluation.status != EvaluationStatus.IN_PROGRESS:
        raise HTTPException(status_code=400, detail="Évaluation déjà terminée")

    # Build conversation and get final scoring
    msg_result = await db.execute(
        select(EvaluationMessage)
        .where(EvaluationMessage.evaluation_id == evaluation.id)
        .order_by(EvaluationMessage.created_at)
    )
    all_messages = msg_result.scalars().all()
    conversation = _build_conversation(all_messages)

    ai_response, meta, usage = await generate_final_scoring(conversation)

    # Log Mistral usage
    await log_api_usage(
        service="mistral", endpoint="chat",
        tokens_in=usage.get("prompt_tokens", 0),
        tokens_out=usage.get("completion_tokens", 0),
        evaluation_id=evaluation.id, user_id=user.id,
    )

    if meta and meta.get("scores"):
        scores = meta["scores"]
        evaluation.score_market_knowledge = scores.get("market_knowledge")
        evaluation.score_terminology = scores.get("terminology")
        evaluation.score_interest_curiosity = scores.get("interest_curiosity")
        evaluation.score_personal_watch = scores.get("personal_watch")
        evaluation.score_technical_level = scores.get("technical_level")
        evaluation.score_ai_usage = scores.get("ai_usage")
        evaluation.score_integration_deployment = scores.get("integration_deployment")
        evaluation.score_conception_dev = scores.get("conception_dev")

        all_scores = [v for v in scores.values() if isinstance(v, (int, float))]
        evaluation.score_global = round(sum(all_scores) / len(all_scores), 1) if all_scores else 0
        evaluation.detected_level = meta.get("detected_level", "intermediaire")
        evaluation.feedback_collaborator = meta.get("feedback_collaborator", "")
        _fa = meta.get("feedback_admin", "")
        evaluation.feedback_admin = json.dumps(_fa, ensure_ascii=False) if isinstance(_fa, dict) else _fa
        if meta.get("job_role"):
            evaluation.job_role = meta["job_role"]
        if meta.get("job_domain"):
            evaluation.job_domain = meta["job_domain"]

    evaluation.status = EvaluationStatus.COMPLETED
    evaluation.completed_at = datetime.now(timezone.utc)

    # Save conclusion message
    ai_msg = EvaluationMessage(
        evaluation_id=evaluation.id,
        role="assistant",
        content=ai_response,
        phase="SCORING",
    )
    db.add(ai_msg)
    await db.flush()

    return EvaluationOut(
        id=evaluation.id,
        user_id=evaluation.user_id,
        status=evaluation.status.value,
        scores=_scores_from_eval(evaluation),
        feedback_collaborator=evaluation.feedback_collaborator,
        total_messages=evaluation.total_messages,
        started_at=evaluation.started_at,
        completed_at=evaluation.completed_at,
        detected_level=evaluation.detected_level,
        job_role=evaluation.job_role,
        job_domain=evaluation.job_domain,
    )


@router.get("/my", response_model=list[EvaluationOut])
async def my_evaluations(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get all evaluations for the current user."""
    result = await db.execute(
        select(Evaluation)
        .where(Evaluation.user_id == user.id)
        .order_by(Evaluation.started_at.desc())
    )
    evaluations = result.scalars().all()

    return [
        EvaluationOut(
            id=ev.id,
            user_id=ev.user_id,
            status=ev.status.value,
            scores=_scores_from_eval(ev) if ev.status == EvaluationStatus.COMPLETED else None,
            feedback_collaborator=ev.feedback_collaborator,
            total_messages=ev.total_messages,
            started_at=ev.started_at,
            completed_at=ev.completed_at,
            detected_level=ev.detected_level,
            job_role=ev.job_role,
            job_domain=ev.job_domain,
        )
        for ev in evaluations
    ]


@router.get("/{evaluation_id}", response_model=EvaluationOut)
async def get_evaluation(
    evaluation_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Evaluation).where(
            Evaluation.id == evaluation_id,
            Evaluation.user_id == user.id,
        )
    )
    ev = result.scalar_one_or_none()
    if not ev:
        raise HTTPException(status_code=404, detail="Évaluation introuvable")

    return EvaluationOut(
        id=ev.id,
        user_id=ev.user_id,
        status=ev.status.value,
        scores=_scores_from_eval(ev) if ev.status == EvaluationStatus.COMPLETED else None,
        feedback_collaborator=ev.feedback_collaborator,
        total_messages=ev.total_messages,
        started_at=ev.started_at,
        completed_at=ev.completed_at,
        detected_level=ev.detected_level,
        job_role=ev.job_role,
        job_domain=ev.job_domain,
    )


@router.get("/{evaluation_id}/messages", response_model=list[MessageOut])
async def get_messages(
    evaluation_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Verify ownership
    result = await db.execute(
        select(Evaluation).where(
            Evaluation.id == evaluation_id,
            Evaluation.user_id == user.id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Évaluation introuvable")

    msg_result = await db.execute(
        select(EvaluationMessage)
        .where(EvaluationMessage.evaluation_id == evaluation_id)
        .order_by(EvaluationMessage.created_at)
    )
    return msg_result.scalars().all()


@router.post("/{evaluation_id}/abandon")
async def abandon_evaluation(
    evaluation_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Abandon an in-progress evaluation so the user can start a new one."""
    result = await db.execute(
        select(Evaluation).where(
            Evaluation.id == evaluation_id,
            Evaluation.user_id == user.id,
        )
    )
    evaluation = result.scalar_one_or_none()
    if not evaluation:
        raise HTTPException(status_code=404, detail="Évaluation introuvable")
    if evaluation.status != EvaluationStatus.IN_PROGRESS:
        raise HTTPException(status_code=400, detail="Cette évaluation n'est pas en cours")

    evaluation.status = EvaluationStatus.ABANDONED
    evaluation.completed_at = datetime.now(timezone.utc)
    await db.flush()
    return {"detail": "Évaluation abandonnée"}
