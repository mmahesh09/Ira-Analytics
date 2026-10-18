from dataclasses import dataclass

from .models import Check, ModuleResult

STATUS_VALUE = {"pass": 1.0, "warn": 0.5, "fail": 0.0}
MODULE_WEIGHTS = {"seo": 35, "aeo": 20, "geo": 25, "performance": 20}


@dataclass
class SiteFiles:
    origin: str
    robots_txt: str | None
    sitemap_url: str | None
    sitemap_ok: bool
    sitemap_url_count: int
    llms_txt: str | None


def score_checks(checks: list[Check]) -> int:
    scored = [c for c in checks if c.status in STATUS_VALUE]
    total = sum(c.weight for c in scored)
    if not total:
        return 0
    return round(100 * sum(STATUS_VALUE[c.status] * c.weight for c in scored) / total)


def overall_score(modules: dict[str, ModuleResult]) -> int:
    parts = [(MODULE_WEIGHTS[k], m.score) for k, m in modules.items() if k in MODULE_WEIGHTS and m.available and m.score is not None]
    total = sum(w for w, _ in parts)
    return round(sum(w * s for w, s in parts) / total) if total else 0


def summarize(checks: list[Check]) -> str:
    fails = sum(c.status == "fail" for c in checks)
    warns = sum(c.status == "warn" for c in checks)
    if not fails and not warns:
        return "Everything we checked looks good."
    parts = []
    if fails:
        parts.append(f"{fails} critical issue{'s' if fails > 1 else ''}")
    if warns:
        parts.append(f"{warns} improvement{'s' if warns > 1 else ''}")
    return " and ".join(parts) + " found."
