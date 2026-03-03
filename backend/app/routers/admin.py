"""Admin router — user management, evaluation review, global statistics."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_password_hash, validate_password_strength
from app.models.evaluation import Evaluation, EvaluationMessage, EvaluationStatus
from app.models.schemas import (
    EvaluationDetail, EvaluationOut, EvaluationScores, GlobalStats,
    MessageOut, UserCreate, UserOut,
)
from app.models.user import User, UserRole
from app.routers.deps import require_admin

router = APIRouter(prefix="/admin", tags=["admin"])


# ── User Management ───────────────────────────────────────────────────

@router.get("/users", response_model=list[UserOut])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return result.scalars().all()


@router.post("/users", response_model=UserOut, status_code=201)
async def create_user(
    body: UserCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    # Validate password strength
    pw_error = validate_password_strength(body.password)
    if pw_error:
        raise HTTPException(status_code=400, detail=pw_error)

    # Check uniqueness
    existing = await db.execute(
        select(User).where((User.email == body.email) | (User.username == body.username))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email ou nom d'utilisateur déjà utilisé")

    role = UserRole.ADMIN if body.role == "admin" else UserRole.COLLABORATOR
    user = User(
        email=body.email,
        username=body.username,
        full_name=body.full_name,
        hashed_password=get_password_hash(body.password),
        role=role,
    )
    db.add(user)
    await db.flush()
    return user


@router.delete("/users/{user_id}")
async def deactivate_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    user.is_active = False
    await db.flush()
    return {"detail": "Utilisateur désactivé"}


# ── Evaluations ───────────────────────────────────────────────────────

@router.get("/evaluations", response_model=list[EvaluationDetail])
async def list_all_evaluations(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    result = await db.execute(
        select(Evaluation).order_by(Evaluation.started_at.desc())
    )
    evaluations = result.scalars().all()

    output = []
    for ev in evaluations:
        # Get associated user
        user_result = await db.execute(select(User).where(User.id == ev.user_id))
        user = user_result.scalar_one_or_none()

        scores = None
        if ev.status == EvaluationStatus.COMPLETED:
            scores = EvaluationScores(
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

        user_out = UserOut.model_validate(user) if user else None

        output.append(EvaluationDetail(
            id=ev.id,
            user_id=ev.user_id,
            status=ev.status.value,
            scores=scores,
            feedback_collaborator=ev.feedback_collaborator,
            feedback_admin=ev.feedback_admin,
            total_messages=ev.total_messages,
            started_at=ev.started_at,
            completed_at=ev.completed_at,
            detected_level=ev.detected_level,
            user=user_out,
        ))

    return output


@router.get("/evaluations/{evaluation_id}", response_model=EvaluationDetail)
async def get_evaluation_detail(
    evaluation_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    result = await db.execute(select(Evaluation).where(Evaluation.id == evaluation_id))
    ev = result.scalar_one_or_none()
    if not ev:
        raise HTTPException(status_code=404, detail="Évaluation introuvable")

    user_result = await db.execute(select(User).where(User.id == ev.user_id))
    user = user_result.scalar_one_or_none()

    msg_result = await db.execute(
        select(EvaluationMessage)
        .where(EvaluationMessage.evaluation_id == evaluation_id)
        .order_by(EvaluationMessage.created_at)
    )
    messages = [
        {"id": m.id, "role": m.role, "content": m.content, "phase": m.phase,
         "created_at": m.created_at.isoformat()}
        for m in msg_result.scalars().all()
    ]

    scores = None
    if ev.status == EvaluationStatus.COMPLETED:
        scores = EvaluationScores(
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

    return EvaluationDetail(
        id=ev.id,
        user_id=ev.user_id,
        status=ev.status.value,
        scores=scores,
        feedback_collaborator=ev.feedback_collaborator,
        feedback_admin=ev.feedback_admin,
        total_messages=ev.total_messages,
        started_at=ev.started_at,
        completed_at=ev.completed_at,
        detected_level=ev.detected_level,
        messages=messages,
        user=UserOut.model_validate(user) if user else None,
    )


# ── Statistics ────────────────────────────────────────────────────────

@router.get("/stats", response_model=GlobalStats)
async def global_statistics(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    # Total evaluations
    total_result = await db.execute(select(func.count(Evaluation.id)))
    total = total_result.scalar() or 0

    # Completed evaluations
    completed_result = await db.execute(
        select(func.count(Evaluation.id)).where(
            Evaluation.status == EvaluationStatus.COMPLETED
        )
    )
    completed = completed_result.scalar() or 0

    # Average global score
    avg_result = await db.execute(
        select(func.avg(Evaluation.score_global)).where(
            Evaluation.status == EvaluationStatus.COMPLETED
        )
    )
    avg_score = avg_result.scalar()
    avg_score = round(avg_score, 1) if avg_score else None

    # Score distribution (brackets)
    score_distribution = {"0-25": 0, "26-50": 0, "51-75": 0, "76-100": 0}
    scores_result = await db.execute(
        select(Evaluation.score_global).where(
            Evaluation.status == EvaluationStatus.COMPLETED,
            Evaluation.score_global.is_not(None),
        )
    )
    for (score,) in scores_result.all():
        if score <= 25:
            score_distribution["0-25"] += 1
        elif score <= 50:
            score_distribution["26-50"] += 1
        elif score <= 75:
            score_distribution["51-75"] += 1
        else:
            score_distribution["76-100"] += 1

    # Level distribution
    level_result = await db.execute(
        select(Evaluation.detected_level, func.count(Evaluation.id))
        .where(Evaluation.status == EvaluationStatus.COMPLETED)
        .group_by(Evaluation.detected_level)
    )
    level_distribution = {level: count for level, count in level_result.all() if level}

    # Domain averages
    domain_fields = [
        ("Connaissance marché", Evaluation.score_market_knowledge),
        ("Terminologie", Evaluation.score_terminology),
        ("Intérêt & curiosité", Evaluation.score_interest_curiosity),
        ("Veille personnelle", Evaluation.score_personal_watch),
        ("Niveau technique", Evaluation.score_technical_level),
        ("Utilisation IA", Evaluation.score_ai_usage),
        ("Intégration & déploiement", Evaluation.score_integration_deployment),
        ("Conception & dev", Evaluation.score_conception_dev),
    ]
    domain_averages = {}
    for label, field in domain_fields:
        r = await db.execute(
            select(func.avg(field)).where(
                Evaluation.status == EvaluationStatus.COMPLETED
            )
        )
        val = r.scalar()
        domain_averages[label] = round(val, 1) if val else 0

    return GlobalStats(
        total_evaluations=total,
        completed_evaluations=completed,
        average_score=avg_score,
        score_distribution=score_distribution,
        level_distribution=level_distribution,
        domain_averages=domain_averages,
    )
