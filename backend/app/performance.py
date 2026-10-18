"""Core Web Vitals and Lighthouse performance.

Google PageSpeed Insights first; when it's unavailable (quota, outage) fall back to running the
Lighthouse CLI locally against an installed Chromium/Edge. Both paths produce the same ModuleResult.
"""

import asyncio
import json
import os
import re
import shutil

import httpx

from .config import settings
from .models import Check, ModuleResult

PSI_URL = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"

# (audit id, label, good threshold, poor threshold, unit, weight)
LAB_METRICS = [
    ("largest-contentful-paint", "Largest Contentful Paint", 2500, 4000, "ms", 3),
    ("cumulative-layout-shift", "Cumulative Layout Shift", 0.1, 0.25, "", 3),
    ("total-blocking-time", "Total Blocking Time", 200, 600, "ms", 2),
    ("first-contentful-paint", "First Contentful Paint", 1800, 3000, "ms", 1),
    ("speed-index", "Speed Index", 3400, 5800, "ms", 1),
]
FIELD_METRICS = {
    "LARGEST_CONTENTFUL_PAINT_MS": "LCP",
    "INTERACTION_TO_NEXT_PAINT": "INP",
    "CUMULATIVE_LAYOUT_SHIFT_SCORE": "CLS",
    "FIRST_CONTENTFUL_PAINT_MS": "FCP",
}


def _plain(markdown: str) -> str:
    return re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", markdown).strip()


BROWSER_CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
]
# one local Lighthouse at a time: each run holds a full browser (~300 MB)
_local_slot = asyncio.Semaphore(1)


def _browser_path() -> str | None:
    if settings.lighthouse_chrome_path:
        return settings.lighthouse_chrome_path
    return next((p for p in BROWSER_CANDIDATES if os.path.exists(p)), None)


async def run_local_lighthouse(url: str) -> dict | None:
    """Runs the Lighthouse CLI (mobile, performance only). Returns the LHR JSON, or None if unavailable."""
    cli, browser = shutil.which("lighthouse"), _browser_path()
    if not (settings.local_lighthouse and cli and browser):
        return None
    async with _local_slot:
        proc = await asyncio.create_subprocess_exec(
            cli, url, "--only-categories=performance", "--form-factor=mobile", "--output=json", "--output-path=stdout", "--quiet",
            "--chrome-flags=--headless=new --no-first-run --disable-extensions",
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL,
            env={**os.environ, "CHROME_PATH": browser},
        )
        try:
            out, _ = await asyncio.wait_for(proc.communicate(), timeout=150)
        except TimeoutError:
            proc.kill()
            return None
    try:
        return json.loads(out)
    except ValueError:
        return None


async def analyze_performance(url: str) -> ModuleResult:
    params = {"url": url, "strategy": "mobile", "category": "performance"}
    if settings.pagespeed_api_key:
        params["key"] = settings.pagespeed_api_key
    body: dict = {}
    source = "PageSpeed Insights"
    try:
        async with httpx.AsyncClient(timeout=90) as client:
            resp = await client.get(PSI_URL, params=params)
        resp.raise_for_status()
        body = resp.json()
        lighthouse = body["lighthouseResult"]
    except (httpx.HTTPError, KeyError, ValueError) as exc:
        lighthouse = await run_local_lighthouse(url)
        source = "Lighthouse (run locally)"
        if not lighthouse or "audits" not in lighthouse:
            quota = isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code == 429
            reason = "shared quota exceeded; add a PageSpeed API key" if quota else exc.__class__.__name__
            return ModuleResult(key="performance", available=False, summary=f"PageSpeed Insights was unavailable ({reason}).")
    return from_lighthouse(lighthouse, body.get("loadingExperience", {}), source)


def from_lighthouse(lighthouse: dict, loading_experience: dict, source: str) -> ModuleResult:
    """Turns a Lighthouse result (from PSI or the local CLI) into the Speed module."""
    audits = lighthouse["audits"]
    checks: list[Check] = []
    lab = []
    for audit_id, label, good, poor, unit, weight in LAB_METRICS:
        audit = audits.get(audit_id)
        if not audit or audit.get("numericValue") is None:
            continue
        value = audit["numericValue"]
        status = "pass" if value <= good else "warn" if value <= poor else "fail"
        lab.append({"id": audit_id, "label": label, "value": value, "display": audit.get("displayValue", ""), "status": status, "unit": unit, "good": good, "poor": poor})
        checks.append(Check(
            id=audit_id, title=f"{label}: {audit.get('displayValue', '')}", status=status, weight=weight,
            detail=f"Good is under {good}{unit}.",
            fix=None if status == "pass" else _plain(audit.get("description", ""))[:300],
        ))

    opportunities = sorted(
        (a for a in audits.values() if a.get("details", {}).get("type") == "opportunity" and (a.get("score") or 1) < 0.9),
        key=lambda a: a.get("details", {}).get("overallSavingsMs", 0),
        reverse=True,
    )[:6]
    for opp in opportunities:
        checks.append(Check(
            id=opp["id"], title=opp["title"], status="warn", weight=1,
            detail=f"Potential saving: {opp.get('displayValue', '')}".strip(),
            fix=_plain(opp.get("description", ""))[:300],
        ))

    field_data = {}
    for key, short in FIELD_METRICS.items():
        metric = loading_experience.get("metrics", {}).get(key)
        if metric:
            value = metric["percentile"] / 100 if short == "CLS" else metric["percentile"]
            field_data[short] = {"value": value, "category": metric.get("category", "")}

    score = round((lighthouse["categories"]["performance"].get("score") or 0) * 100)
    return ModuleResult(
        key="performance",
        score=score,
        summary=f"Lighthouse mobile performance score {score}/100 · {source}.",
        checks=checks,
        data={"lab": lab, "field": field_data, "strategy": "mobile", "source": source},
    )
