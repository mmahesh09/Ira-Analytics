"""Smart Issue Prioritization: how hard each fix is and how sure we are that it matters.

The client ranks open issues by  impact × confidence ÷ effort, where impact is the overall-score gain
of fixing the check alone (frontend/src/lib/scoring.ts `prioritize`).
"""

from .models import Check, Severity

# 1 = minutes (paste a tag or a file), 2 = about an hour, 3 = a day or more (content or engineering work)
EFFORT: dict[str, int] = {
    # SEO
    "title": 1, "meta-description": 1, "canonical": 1, "lang": 1, "viewport": 1, "favicon": 1, "open-graph": 1,
    "robots-txt": 1, "indexable": 1, "h1": 1, "structured-data": 1, "breadcrumbs": 1, "sitemap": 2,
    "heading-order": 2, "img-alt": 2, "https": 2, "internal-links": 2, "broken-links": 2, "response-time": 3,
    # AEO
    "answer-schema": 1, "question-headings": 2, "concise-answers": 2, "structured-content": 2, "summary": 2,
    "content-length": 3,
    # GEO
    "ai-crawlers": 1, "llms-txt": 1, "entity": 1, "entity-schema": 1, "authorship": 2, "freshness": 2,
    "citations": 2, "statistics": 2, "server-rendered": 3, "ai-visibility": 3,
    # Speed
    "cumulative-layout-shift": 2, "largest-contentful-paint": 3, "total-blocking-time": 3,
    "first-contentful-paint": 3, "speed-index": 3,
}

# facts (a blocked crawler, a missing tag) are near-certain; content heuristics less so
CONFIDENCE: dict[str, float] = {
    "concise-answers": 0.6, "content-length": 0.5, "statistics": 0.5, "citations": 0.6, "freshness": 0.6,
    "summary": 0.6, "structured-content": 0.65, "heading-order": 0.6, "ai-visibility": 0.5, "authorship": 0.65,
    "question-headings": 0.7, "internal-links": 0.7, "open-graph": 0.7, "favicon": 0.6,
}

DEFAULT_EFFORT = 2
DEFAULT_CONFIDENCE = 0.85


def severity(check: Check) -> Severity | None:
    if check.status not in ("fail", "warn"):
        return None
    if check.status == "fail" and check.weight >= 3:
        return "critical"
    if check.status == "fail" or check.weight >= 3:
        return "high"
    return "medium" if check.weight >= 2 else "low"


def annotate(check: Check) -> None:
    """Stamps severity, effort and confidence onto an open issue (passing checks are left alone)."""
    sev = severity(check)
    if sev is None:
        return
    check.severity = sev
    check.effort = EFFORT.get(check.id, DEFAULT_EFFORT)
    check.confidence = CONFIDENCE.get(check.id, DEFAULT_CONFIDENCE)
