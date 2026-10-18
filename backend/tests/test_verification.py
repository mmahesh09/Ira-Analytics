"""Feature 13, Before-and-After Verification: the verdict for a "Mark fixed" request."""

from app.monitoring import module_score, verify_outcome


def report(checks, available=True, score=72):
    return {"modules": {"seo": {"available": available, "score": score if available else None, "checks": checks}}}


def test_fixed_when_the_check_now_passes():
    assert verify_outcome(report([{"id": "canonical", "status": "pass"}]), "seo", "canonical") == ("fixed", "pass", 72)


def test_fixed_when_the_check_no_longer_applies():
    # e.g. the page that triggered it is gone; the module ran, so absence means not a problem any more
    assert verify_outcome(report([{"id": "title", "status": "pass"}]), "seo", "canonical") == ("fixed", "gone", 72)


def test_info_counts_as_fixed():
    assert verify_outcome(report([{"id": "canonical", "status": "info"}]), "seo", "canonical")[0] == "fixed"


def test_still_failing_on_warn_or_fail():
    assert verify_outcome(report([{"id": "canonical", "status": "warn"}]), "seo", "canonical") == ("still_failing", "warn", 72)
    assert verify_outcome(report([{"id": "canonical", "status": "fail"}]), "seo", "canonical")[0] == "still_failing"


def test_unmeasured_when_the_module_could_not_run():
    # a PageSpeed outage must never read as "fixed"
    assert verify_outcome(report([], available=False), "seo", "canonical") == ("unmeasured", None, None)
    assert verify_outcome({"modules": {}}, "performance", "largest-contentful-paint") == ("unmeasured", None, None)


def test_module_score():
    assert module_score(report([]), "seo") == 72
    assert module_score(report([], available=False), "seo") is None
    assert module_score(None, "seo") is None
