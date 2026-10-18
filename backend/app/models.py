from typing import Any, Literal

from pydantic import BaseModel, Field

Status = Literal["pass", "warn", "fail", "info"]
ModuleKey = Literal["seo", "aeo", "geo", "performance", "accessibility", "traffic"]


class Check(BaseModel):
    id: str
    title: str
    status: Status
    weight: int = 1
    detail: str = ""
    fix: str | None = None


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
