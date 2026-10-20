import re
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Status = Literal["pass", "warn", "fail", "info"]
ModuleKey = Literal["seo", "aeo", "geo", "performance", "accessibility", "traffic"]


Severity = Literal["critical", "high", "medium", "low"]


class Snippet(BaseModel):
    """Ready-to-paste code for a fix (One-Click Fix Suggestions)."""
    lang: Literal["html", "json", "text", "markdown", "xml"]
    file: str  # where it goes, e.g. "<head>", "robots.txt"
    code: str


class Check(BaseModel):
    id: str
    title: str
    status: Status
    weight: int = 1
    detail: str = ""
    fix: str | None = None
    # Smart Issue Prioritization (set by priority.annotate; absent on old cached reports)
    severity: Severity | None = None
    effort: int | None = None  # 1 = minutes, 2 = about an hour, 3 = a day or more
    confidence: float | None = None  # 0-1: how sure we are the fix moves rankings or citations
    snippet: Snippet | None = None


class ModuleResult(BaseModel):
    key: ModuleKey
    available: bool = True
    score: int | None = None
    summary: str = ""
    checks: list[Check] = Field(default_factory=list)
    data: dict[str, Any] = Field(default_factory=dict)


class AuditRequest(BaseModel):
    url: str = Field(min_length=3, max_length=2048)


class AuditReport(BaseModel):
    url: str
    final_url: str
    domain: str
    fetched_at: str
    overall_score: int
    modules: dict[str, ModuleResult]
    # full: every module | light: fetch-only SEO/AEO/GEO rules (monitoring checks and the anonymous preview)
    mode: str = "full"


# ---------- product feedback (public /feedback form) ----------

FeedbackRole = Literal["founder", "seo_specialist", "marketing_manager", "agency_owner", "content_writer", "developer", "other"]
UsageFrequency = Literal["daily", "several_weekly", "weekly", "occasionally", "first_time"]
PrimaryGoal = Literal[
    "ai_visibility", "brand_mentions", "content_opportunities", "ai_content",
    "technical_seo", "publishing", "performance_monitoring", "other",
]
ProductFeature = Literal[
    "visibility_audit", "citation_tracking", "scorecard", "content_planning",
    "ai_articles", "technical_seo", "cms_publishing", "performance_reporting", "none_yet",
]
Challenge = Literal[
    "hard_to_understand", "missing_features", "inaccurate_data", "weak_recommendations", "confusing_setup",
    "integration_issues", "slow_performance", "pricing", "no_issues", "other",
]

_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
LONG_TEXT = 2000


def _clean(value: str | None) -> str | None:
    value = (value or "").strip()
    return value or None


class FeedbackIn(BaseModel):
    """One feedback submission. Unknown fields are refused; blank optional text is stored as NULL."""

    model_config = ConfigDict(extra="forbid")

    submission_id: UUID
    name: str | None = Field(default=None, max_length=120)
    email: str | None = Field(default=None, max_length=254)
    role: FeedbackRole
    role_other: str | None = Field(default=None, max_length=120)
    usage_frequency: UsageFrequency
    satisfaction_rating: int = Field(ge=1, le=5)
    usability_rating: int = Field(ge=1, le=5)
    recommendation_score: int = Field(ge=0, le=10)
    primary_goal: PrimaryGoal
    primary_goal_other: str | None = Field(default=None, max_length=120)
    features_used: list[ProductFeature] = Field(default_factory=list, max_length=9)
    most_valuable_feature: ProductFeature | None = None
    biggest_challenge: Challenge
    biggest_challenge_other: str | None = Field(default=None, max_length=120)
    positive_feedback: str | None = Field(default=None, max_length=LONG_TEXT)
    improvement_suggestions: str | None = Field(default=None, max_length=LONG_TEXT)
    requested_feature: str | None = Field(default=None, max_length=LONG_TEXT)
    additional_comments: str | None = Field(default=None, max_length=LONG_TEXT)
    contact_permission: bool = False

    @field_validator(
        "name", "email", "role_other", "primary_goal_other", "biggest_challenge_other",
        "positive_feedback", "improvement_suggestions", "requested_feature", "additional_comments",
    )
    @classmethod
    def _blank_is_none(cls, value: str | None) -> str | None:
        return _clean(value)

    @field_validator("email")
    @classmethod
    def _email(cls, value: str | None) -> str | None:
        if value is not None and not _EMAIL.match(value):
            raise ValueError("Enter a valid email address, or leave it blank.")
        return value

    @field_validator("features_used")
    @classmethod
    def _features(cls, value: list[str]) -> list[str]:
        if len(set(value)) != len(value):
            raise ValueError("Each feature can be listed once.")
        if "none_yet" in value and len(value) > 1:
            raise ValueError("'None yet' can't be combined with other features.")
        return value

    @model_validator(mode="after")
    def _other_text(self) -> "FeedbackIn":
        for choice, other in (("role", "role_other"), ("primary_goal", "primary_goal_other"), ("biggest_challenge", "biggest_challenge_other")):
            if getattr(self, choice) == "other":
                if not getattr(self, other):
                    raise ValueError(f"Describe your answer for '{choice.replace('_', ' ')}' when you pick Other.")
            else:
                setattr(self, other, None)  # text typed before switching away from Other isn't kept
        if self.contact_permission and not self.email:
            self.contact_permission = False  # nothing to contact
        return self
