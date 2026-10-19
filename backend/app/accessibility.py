"""Accessibility Checker + Visual Website Doctor.

One headless browser visit: run axe-core (WCAG 2.0/2.1 A + AA), measure where each failing element sits,
and save a screenshot so the report can draw numbered boxes over the problems.
"""

import asyncio
import uuid
from pathlib import Path

from playwright.async_api import Error as PlaywrightError
from playwright.async_api import async_playwright

from .common import score_checks
from .config import settings
from .models import Check, ModuleResult
from .performance import _browser_path

AXE_JS = (Path(__file__).parent / "vendor" / "axe.min.js").read_text(encoding="utf-8")
SHOTS_DIR = Path(__file__).resolve().parent.parent / "data" / "shots"
VIEWPORT = {"width": 1280, "height": 800}
MAX_SHOT_HEIGHT = 4000
IMPACT_WEIGHT = {"critical": 4, "serious": 3, "moderate": 2, "minor": 1}
IMPACT_STATUS = {"critical": "fail", "serious": "fail", "moderate": "warn", "minor": "warn"}
_browser_slot = asyncio.Semaphore(1)  # one headless browser at a time (memory)

RUN_AXE = """async () => {
  const r = await axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    resultTypes: ['violations'],
  });
  return {
    passes: r.passes.length,
    incomplete: r.incomplete.length,
    violations: r.violations.map(v => ({
      id: v.id, impact: v.impact || 'minor', help: v.help, description: v.description, helpUrl: v.helpUrl,
      count: v.nodes.length,
      targets: v.nodes.slice(0, 3).map(n => n.target[0]).filter(t => typeof t === 'string'),
      html: v.nodes.slice(0, 1).map(n => n.html.slice(0, 160)),
      summary: v.nodes.slice(0, 1).map(n => (n.failureSummary || '').slice(0, 300)),
    })),
  };
}"""

BOXES = """(targets) => targets.map(([n, sel]) => {
  const el = document.querySelector(sel);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  return { n, x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height };
}).filter(Boolean)"""


async def analyze_accessibility(url: str) -> ModuleResult:
    browser_path = _browser_path()
    if not (settings.browser_checks and browser_path):
        return ModuleResult(key="accessibility", available=False, summary="Accessibility checks need a local Chrome or Edge.")
    try:
        async with _browser_slot, async_playwright() as pw:
            browser = await pw.chromium.launch(executable_path=browser_path, headless=True, args=["--no-first-run", "--disable-extensions", *(["--no-sandbox", "--disable-dev-shm-usage"] if settings.chrome_no_sandbox else [])])
            try:
                page = await browser.new_page(viewport=VIEWPORT, user_agent=settings.user_agent + " (accessibility check)")
                await page.goto(url, wait_until="load", timeout=30_000)
                await page.wait_for_timeout(800)  # let late layout settle before measuring
                await page.add_script_tag(content=AXE_JS)
                result = await page.evaluate(RUN_AXE)

                order = {"critical": 0, "serious": 1, "moderate": 2, "minor": 3}
                violations = sorted(result["violations"], key=lambda v: (order.get(v["impact"], 4), -v["count"]))
                for i, v in enumerate(violations, start=1):
                    v["n"] = i
                targets = [[v["n"], t] for v in violations for t in v["targets"]]
                boxes = await page.evaluate(BOXES, targets) if targets else []

                doc_height = await page.evaluate("document.documentElement.scrollHeight")
                shot_height = min(doc_height, MAX_SHOT_HEIGHT)
                SHOTS_DIR.mkdir(parents=True, exist_ok=True)
                name = f"{uuid.uuid4().hex}.jpg"
                await page.screenshot(path=SHOTS_DIR / name, type="jpeg", quality=62, full_page=True, clip={"x": 0, "y": 0, "width": VIEWPORT["width"], "height": shot_height})
            finally:
                await browser.close()
    except (PlaywrightError, TimeoutError) as exc:
        return ModuleResult(key="accessibility", available=False, summary=f"The page couldn't be opened in a browser ({exc.__class__.__name__}).")

    checks = [
        Check(
            id=v["id"],
            title=f"{v['help']} ({v['count']} element{'s' if v['count'] != 1 else ''})",
            status=IMPACT_STATUS.get(v["impact"], "warn"),
            weight=IMPACT_WEIGHT.get(v["impact"], 1),
            detail=f"{v['impact'].capitalize()} impact. {v['description']}",
            fix=(v["summary"][0] if v["summary"] else None) or f"See {v['helpUrl']}",
        )
        for v in violations
    ]
    # every rule that passed counts as a passing check, so the score reflects coverage, not only failures
    scored = checks + [Check(id=f"pass-{i}", title="passed", status="pass", weight=1) for i in range(result["passes"])]
    score = score_checks(scored)
    serious = sum(1 for v in violations if v["impact"] in ("critical", "serious"))
    summary = (
        f"{len(violations)} accessibility rule{'s' if len(violations) != 1 else ''} failing ({serious} critical or serious), {result['passes']} passing."
        if violations
        else f"No WCAG A/AA violations found across {result['passes']} rules."
    )
    return ModuleResult(
        key="accessibility",
        score=score,
        summary=summary,
        checks=checks,
        data={
            "screenshot": f"/api/shots/{name}",
            "width": VIEWPORT["width"],
            "height": shot_height,
            "boxes": [b for b in boxes if b["y"] < shot_height],
            "violations": [{k: v[k] for k in ("n", "id", "impact", "help", "helpUrl", "count", "html")} for v in violations],
            "passes": result["passes"],
            "incomplete": result["incomplete"],
        },
    )
