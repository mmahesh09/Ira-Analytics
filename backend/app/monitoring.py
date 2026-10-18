"""Health history, change detection and regression alerts.

Pure functions (fingerprints, diff_issues, regressions, next_run) are kept free of I/O so they can be
unit-tested; record_audit() applies them to the database after every scheduled or triggered audit.
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import AuditReport
from .schema import Alert, Audit, Issue, Site

SCORED = ("seo", "aeo", "geo", "performance", "accessibility")
# lab metric id -> (minimum absolute worsening that counts, label)
REGRESSION_FLOOR = {
    "largest-contentful-paint": (500.0, "Largest Contentful Paint"),
    "total-blocking-time": (100.0, "Total Blocking Time"),
    "cumulative-layout-shift": (0.05, "Cumulative Layout Shift"),
}
STATUS_RANK = {"pass": 0, "warn": 1, "fail": 2}
CADENCE_DAYS = {"daily": 1, "weekly": 7, "monthly": 30}


# ---------- pure logic ----------

def fingerprints(report: dict) -> dict[str, dict]:
    """Open problems in a report, keyed by a stable fingerprint (module:check id)."""
    found: dict[str, dict] = {}
    for key in SCORED:
        mod = (report.get("modules") or {}).get(key)
        if not mod or not mod.get("available", True):
            continue
        for check in mod.get("checks", []):
            if check.get("status") in ("fail", "warn"):
                found[f"{key}:{check['id']}"] = {"module": key, "check_id": check["id"], "title": check["title"], "severity": check["status"]}
    return found


@dataclass
class IssueDiff:
    new: list[str] = field(default_factory=list)
    resolved: list[str] = field(default_factory=list)
    still_open: list[str] = field(default_factory=list)


def diff_issues(previously_open: set[str], current: dict[str, dict], measured_modules: set[str]) -> IssueDiff:
    """What changed since the last audit. Issues in a module that couldn't be measured this time are left alone,
    so a PageSpeed outage never shows up as "everything resolved"."""
    result = IssueDiff()
    for fp in current:
        (result.still_open if fp in previously_open else result.new).append(fp)
    for fp in previously_open:
        if fp not in current and fp.split(":", 1)[0] in measured_modules:
            result.resolved.append(fp)
    return result


def measured(report: dict) -> set[str]:
    return {k for k in SCORED if ((report.get("modules") or {}).get(k) or {}).get("available")}


def verify_outcome(report: dict, module: str, check_id: str) -> tuple[str, str | None, int | None]:
    """Verdict for one "Mark fixed" request against a fresh audit: (status, check status, module score).

    fixed: the check now passes (or no longer applies) in a module that was measured; still_failing: it's
    still warn/fail; unmeasured: the module couldn't run this time, so we can't say either way."""
    mod = (report.get("modules") or {}).get(module) or {}
    if not mod.get("available"):
        return "unmeasured", None, None
    check = next((c for c in mod.get("checks", []) if c.get("id") == check_id), None)
    status = check.get("status") if check else "gone"
    return ("still_failing" if status in ("fail", "warn") else "fixed"), status, mod.get("score")


def module_score(report: dict | None, module: str) -> int | None:
    mod = ((report or {}).get("modules") or {}).get(module) or {}
    return mod.get("score") if mod.get("available") else None


def regressions(previous: dict | None, current: dict) -> list[str]:
    """Human-readable alerts for score drops and worse Core Web Vitals."""
    if not previous:
        return []
    alerts: list[str] = []
    drop = (previous.get("overall_score") or 0) - (current.get("overall_score") or 0)
    if drop >= 10:
        alerts.append(f"Overall score dropped {drop} points ({previous['overall_score']} → {current['overall_score']}).")
    for key in SCORED:
        before = ((previous.get("modules") or {}).get(key) or {}).get("score")
        after = ((current.get("modules") or {}).get(key) or {}).get("score")
        if before is not None and after is not None and before - after >= 15:
            alerts.append(f"{key.upper() if key != 'performance' else 'Speed'} score dropped {before - after} points ({before} → {after}).")

    def lab(report: dict) -> dict[str, dict]:
        perf = (report.get("modules") or {}).get("performance") or {}
        return {m["id"]: m for m in (perf.get("data") or {}).get("lab", [])}

    old, new = lab(previous), lab(current)
    for metric_id, (floor, label) in REGRESSION_FLOOR.items():
        a, b = old.get(metric_id), new.get(metric_id)
        if not a or not b:
            continue
        worse_status = STATUS_RANK.get(b["status"], 0) > STATUS_RANK.get(a["status"], 0)
        big_jump = b["value"] - a["value"] >= floor and b["value"] >= a["value"] * 1.25
        if worse_status or big_jump:
            alerts.append(f"{label} got slower: {a.get('display') or a['value']} → {b.get('display') or b['value']}.")
    return alerts


def next_run(cadence: str, plan_cadence: str, now: datetime) -> datetime | None:
    """When the next scheduled audit is due: the site's choice, but never more often than the plan allows."""
    if cadence == "off":
        return None
    days = max(CADENCE_DAYS.get(cadence, 7), CADENCE_DAYS.get(plan_cadence, 30))
    return now + timedelta(days=days)


# ---------- database ----------

async def record_audit(db: AsyncSession, site: Site, report: AuditReport, trigger: str) -> dict:
    """Stores an audit, updates issue history and raises alerts. Returns a summary of what changed."""
    data = report.model_dump()
    previous = await db.scalar(select(Audit).where(Audit.site_id == site.id).order_by(Audit.created_at.desc()).limit(1))

    def score(key: str) -> int | None:
        mod = report.modules.get(key)
        return mod.score if mod and mod.available else None

    audit = Audit(
        site_id=site.id,
        url=report.final_url,
        overall_score=report.overall_score,
        seo=score("seo"),
        aeo=score("aeo"),
        geo=score("geo"),
        speed=score("performance"),
        report=data,
        trigger=trigger,
    )
    db.add(audit)
    await db.flush()

    now = datetime.now(timezone.utc)
    open_rows = {i.fingerprint: i for i in await db.scalars(select(Issue).where(Issue.site_id == site.id, Issue.status == "open"))}
    current = fingerprints(data)
    change = diff_issues(set(open_rows), current, measured(data))

    for fp in change.still_open:
        row = open_rows[fp]
        row.last_seen_at, row.last_audit_id = now, audit.id
        row.severity, row.title = current[fp]["severity"], current[fp]["title"]
    for fp in change.new:
        existing = await db.scalar(select(Issue).where(Issue.site_id == site.id, Issue.fingerprint == fp))
        if existing:  # came back after being resolved
            existing.status, existing.resolved_at = "open", None
            existing.last_seen_at, existing.last_audit_id = now, audit.id
            existing.severity, existing.title = current[fp]["severity"], current[fp]["title"]
        else:
            db.add(Issue(site_id=site.id, fingerprint=fp, last_audit_id=audit.id, last_seen_at=now, **current[fp]))
    for fp in change.resolved:
        open_rows[fp].status, open_rows[fp].resolved_at = "resolved", now

    messages = regressions(previous.report if previous else None, data)
    new_critical = [current[fp]["title"] for fp in change.new if current[fp]["severity"] == "fail"]
    if previous and new_critical:
        messages.append(f"New critical issue{'s' if len(new_critical) > 1 else ''}: {'; '.join(new_critical[:3])}.")
    for message in messages:
        db.add(Alert(site_id=site.id, kind="regression" if "slower" in message or "dropped" in message else "new_issue", message=message[:500]))

    await db.commit()
    return {"audit_id": audit.id, "new": len(change.new), "resolved": len(change.resolved), "alerts": len(messages)}
