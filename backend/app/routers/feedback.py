"""Product feedback: a public submit endpoint and admin-only reads (list, detail, stats, CSV export).

Rows are insert-only: there are no update or delete routes. Every admin route depends on auth.admin_user, which
answers 404 to anyone who isn't an admin.
"""

import csv
import io
from datetime import date, datetime, time, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import Select, func, or_, select, true, type_coerce
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from .. import ratelimit
from ..auth import admin_user
from ..config import settings
from ..db import get_session
from ..models import FeedbackIn, FeedbackRole, ProductFeature
from ..schema import Feedback

router = APIRouter(prefix="/api", tags=["feedback"])

TEXT_FIELDS = ("name", "email", "role_other", "primary_goal_other", "biggest_challenge_other",
               "positive_feedback", "improvement_suggestions", "requested_feature", "additional_comments")
COLUMNS = ("id", "created_at", "name", "email", "role", "role_other", "usage_frequency", "satisfaction_rating",
           "usability_rating", "recommendation_score", "primary_goal", "primary_goal_other", "features_used",
           "most_valuable_feature", "biggest_challenge", "biggest_challenge_other", "positive_feedback",
           "improvement_suggestions", "requested_feature", "additional_comments", "contact_permission")
SORTS = {
    "created_at": Feedback.created_at,
    "satisfaction_rating": Feedback.satisfaction_rating,
    "usability_rating": Feedback.usability_rating,
    "recommendation_score": Feedback.recommendation_score,
}
TREND_DAYS = 30
EXPORT_CAP = 50_000


@router.post("/feedback", status_code=201)
async def submit(body: FeedbackIn, request: Request, db: AsyncSession = Depends(get_session)):
    await ratelimit.hit(ratelimit.ip_key("feedback", ratelimit.client_ip(request)), settings.feedback_per_ip_per_10min, window=600)
    values = body.model_dump()
    values["submission_id"] = str(body.submission_id)
    # the same submission_id again (double click, retry after a lost response) is accepted without a second row
    await db.execute(pg_insert(Feedback).values(**values).on_conflict_do_nothing(index_elements=["submission_id"]))
    await db.commit()
    return {"ok": True}


# ---------- admin ----------

class Filters(BaseModel):
    q: str | None = None
    date_from: date | None = None
    date_to: date | None = None
    role: FeedbackRole | None = None
    min_rating: int | None = None
    max_rating: int | None = None
    feature: ProductFeature | None = None


def filters(
    q: str | None = Query(default=None, max_length=200),
    date_from: date | None = None,
    date_to: date | None = None,
    role: FeedbackRole | None = None,
    min_rating: int | None = Query(default=None, ge=1, le=5),
    max_rating: int | None = Query(default=None, ge=1, le=5),
    feature: ProductFeature | None = None,
) -> Filters:
    return Filters(q=(q or "").strip() or None, date_from=date_from, date_to=date_to, role=role,
                   min_rating=min_rating, max_rating=max_rating, feature=feature)


def _where(stmt: Select, f: Filters) -> Select:
    if f.q:
        pattern = "%" + f.q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
        stmt = stmt.where(or_(*(getattr(Feedback, name).ilike(pattern, escape="\\") for name in TEXT_FIELDS)))
    if f.date_from:
        stmt = stmt.where(Feedback.created_at >= datetime.combine(f.date_from, time.min, timezone.utc))
    if f.date_to:  # inclusive: the whole of date_to (UTC)
        stmt = stmt.where(Feedback.created_at < datetime.combine(f.date_to + timedelta(days=1), time.min, timezone.utc))
    if f.role:
        stmt = stmt.where(Feedback.role == f.role)
    if f.min_rating:
        stmt = stmt.where(Feedback.satisfaction_rating >= f.min_rating)
    if f.max_rating:
        stmt = stmt.where(Feedback.satisfaction_rating <= f.max_rating)
    if f.feature:
        stmt = stmt.where(type_coerce(Feedback.features_used, JSONB).contains([f.feature]))
    return stmt


def _row(item: Feedback) -> dict:
    return {name: getattr(item, name) for name in COLUMNS}


@router.get("/admin/feedback")
async def list_feedback(
    f: Filters = Depends(filters),
    page: int = Query(default=1, ge=1, le=10_000),
    page_size: int = Query(default=20, ge=1, le=100),
    sort: Literal["created_at", "satisfaction_rating", "usability_rating", "recommendation_score"] = "created_at",
    order: Literal["asc", "desc"] = "desc",
    _admin=Depends(admin_user),
    db: AsyncSession = Depends(get_session),
):
    total = await db.scalar(_where(select(func.count()).select_from(Feedback), f))
    column = SORTS[sort]
    rows = await db.scalars(
        _where(select(Feedback), f)
        .order_by(column.asc() if order == "asc" else column.desc(), Feedback.id.desc())
        .offset((page - 1) * page_size).limit(page_size)
    )
    return {"items": [_row(item) for item in rows], "total": total, "page": page, "page_size": page_size}


@router.get("/admin/feedback/stats")
async def feedback_stats(f: Filters = Depends(filters), _admin=Depends(admin_user), db: AsyncSession = Depends(get_session)):
    total, satisfaction, usability, recommendation, promoters, detractors, requests = (await db.execute(_where(select(
        func.count(),
        func.avg(Feedback.satisfaction_rating),
        func.avg(Feedback.usability_rating),
        func.avg(Feedback.recommendation_score),
        func.count().filter(Feedback.recommendation_score >= 9),
        func.count().filter(Feedback.recommendation_score <= 6),
        func.count(Feedback.requested_feature),
    ).select_from(Feedback), f))).one()

    start = datetime.now(timezone.utc).date() - timedelta(days=TREND_DAYS - 1)
    day = func.date(func.timezone("UTC", Feedback.created_at))
    counts = dict((await db.execute(
        _where(select(day, func.count()).select_from(Feedback), f)
        .where(Feedback.created_at >= datetime.combine(start, time.min, timezone.utc))
        .group_by(day)
    )).all())
    trend = [{"date": (start + timedelta(days=i)).isoformat(), "count": counts.get(start + timedelta(days=i), 0)} for i in range(TREND_DAYS)]

    async def top(column) -> list[dict]:
        n = func.count().label("n")
        rows = await db.execute(_where(select(column, n).select_from(Feedback), f).where(column.is_not(None)).group_by(column).order_by(n.desc(), column).limit(10))
        return [{"value": value, "count": count} for value, count in rows]

    used = func.jsonb_array_elements_text(type_coerce(Feedback.features_used, JSONB)).table_valued("value").render_derived(name="used")
    n = func.count().label("n")
    features_used = [
        {"value": value, "count": count}
        for value, count in await db.execute(
            _where(select(used.c.value, n).select_from(Feedback).join(used, true()), f).group_by(used.c.value).order_by(n.desc(), used.c.value)
        )
    ]
    recent_requests = [
        {"id": item.id, "text": item.requested_feature, "created_at": item.created_at}
        for item in await db.scalars(_where(select(Feedback), f).where(Feedback.requested_feature.is_not(None)).order_by(Feedback.created_at.desc()).limit(8))
    ]

    def avg(value) -> float | None:
        return round(float(value), 2) if value is not None else None

    return {
        "total": total,
        "avg_satisfaction": avg(satisfaction),
        "avg_usability": avg(usability),
        "avg_recommendation": avg(recommendation),
        # Net Promoter Score: % promoters (9-10) minus % detractors (0-6)
        "nps": round((promoters - detractors) * 100 / total) if total else None,
        "feature_requests": requests,
        "trend": trend,
        "top_challenges": await top(Feedback.biggest_challenge),
        "top_valued_features": await top(Feedback.most_valuable_feature),
        "features_used": features_used,
        "recent_requests": recent_requests,
    }


def _csv_cell(value) -> str:
    if value is None:
        return ""
    if isinstance(value, list):
        value = "; ".join(value)
    elif isinstance(value, datetime):
        value = value.isoformat()
    value = str(value)
    # spreadsheet apps run cells that start with these as formulas (CSV injection)
    return "'" + value if value[:1] in ("=", "+", "-", "@", "\t", "\r") else value


@router.get("/admin/feedback/export.csv")
async def export_feedback(f: Filters = Depends(filters), _admin=Depends(admin_user), db: AsyncSession = Depends(get_session)):
    rows = await db.scalars(_where(select(Feedback), f).order_by(Feedback.created_at.desc()).limit(EXPORT_CAP))
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(COLUMNS)
    for item in rows:
        writer.writerow([_csv_cell(getattr(item, name)) for name in COLUMNS])
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    return Response(
        "﻿" + out.getvalue(),  # BOM so Excel reads UTF-8
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="rankwise-feedback-{stamp}.csv"', "Cache-Control": "no-store"},
    )


@router.get("/admin/feedback/{feedback_id}")
async def feedback_detail(feedback_id: int, _admin=Depends(admin_user), db: AsyncSession = Depends(get_session)):
    item = await db.get(Feedback, feedback_id)
    if not item:
        raise HTTPException(404, "Feedback not found.")
    return _row(item)
