from datetime import datetime, timedelta, timezone

from app.crawler import is_broken
from app.monitoring import diff_issues, fingerprints, measured, next_run, regressions


def report(overall=70, seo=80, aeo=50, geo=60, perf=None, seo_checks=None, perf_available=True, lab=None):
    def mod(score, checks=(), available=True, data=None):
        return {"available": available, "score": score if available else None, "checks": list(checks), "data": data or {}}

    return {
        "overall_score": overall,
        "modules": {
            "seo": mod(seo, seo_checks or []),
            "aeo": mod(aeo),
            "geo": mod(geo),
            "performance": mod(perf, available=perf_available, data={"lab": lab or []}),
        },
    }


def check(cid, status, title="t"):
    return {"id": cid, "status": status, "title": title}


def test_fingerprints_only_open_problems():
    r = report(seo_checks=[check("title", "warn"), check("meta", "fail"), check("lang", "pass")])
    assert set(fingerprints(r)) == {"seo:title", "seo:meta"}
    assert fingerprints(r)["seo:meta"]["severity"] == "fail"


def test_diff_new_resolved_still_open():
    current = {"seo:a": {}, "seo:b": {}}
    d = diff_issues({"seo:b", "seo:c"}, current, {"seo"})
    assert d.new == ["seo:a"] and d.still_open == ["seo:b"] and d.resolved == ["seo:c"]


def test_unmeasured_module_does_not_resolve_its_issues():
    # Speed couldn't run this time: its old issues must stay open, not flip to "resolved"
    r = report(perf_available=False)
    d = diff_issues({"performance:lcp"}, {}, measured(r))
    assert d.resolved == []


def test_score_drop_alerts():
    msgs = regressions(report(overall=80, seo=90), report(overall=65, seo=70))
    assert any("Overall score dropped 15" in m for m in msgs)
    assert any("SEO score dropped 20" in m for m in msgs)
    assert regressions(None, report()) == []
    assert regressions(report(overall=80), report(overall=75)) == []  # small dips are noise


def test_core_web_vitals_regression():
    lcp = lambda v, s: {"id": "largest-contentful-paint", "value": v, "status": s, "display": f"{v} ms"}  # noqa: E731
    slower = regressions(report(perf=90, lab=[lcp(1800, "pass")]), report(perf=88, lab=[lcp(3000, "warn")]))
    assert any("Largest Contentful Paint got slower" in m for m in slower)
    steady = regressions(report(perf=90, lab=[lcp(1800, "pass")]), report(perf=90, lab=[lcp(1900, "pass")]))
    assert not any("slower" in m for m in steady)


def test_next_run_respects_plan_limit():
    now = datetime(2026, 10, 18, tzinfo=timezone.utc)
    assert next_run("daily", "daily", now) == now + timedelta(days=1)
    assert next_run("daily", "monthly", now) == now + timedelta(days=30)  # Free can't run daily
    assert next_run("off", "daily", now) is None


def test_broken_link_rules():
    assert is_broken(404) and is_broken(500) and is_broken(None)
    assert not is_broken(200) and not is_broken(301)
    assert not is_broken(403) and not is_broken(999)  # bot-blocked, not broken
