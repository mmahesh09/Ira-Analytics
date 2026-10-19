from typing import Any, Literal

from pydantic import BaseModel, Field

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
