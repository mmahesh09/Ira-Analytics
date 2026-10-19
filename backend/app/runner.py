"""Orchestrates one audit and emits progress events as each module finishes."""

import asyncio
import re
import time
from collections.abc import AsyncIterator
from datetime import datetime, timezone
from urllib.parse import urlparse

from .accessibility import analyze_accessibility
from .aeo import analyze_aeo
from .common import SiteFiles, overall_score
from .fetcher import AuditError, fetch, fetch_optional, make_client, normalize_url
from .fixes import snippet_for
from .geo import analyze_geo
from .models import AuditReport, ModuleResult
from .page import parse_page
from .performance import analyze_performance
from .priority import annotate
from .seo import analyze_seo
from .traffic import analyze_traffic

CACHE_TTL = 15 * 60
_cache: dict[str, tuple[float, AuditReport]] = {}


def _plain_text(result) -> str | None:
    if result and result.status == 200 and "<html" not in result.text[:500].lower():
        return result.text
    return None


async def _site_files(client, origin: str) -> SiteFiles:
    robots, llms = await asyncio.gather(
        fetch_optional(client, f"{origin}/robots.txt"),
        fetch_optional(client, f"{origin}/llms.txt", max_bytes=256 * 1024),
    )
    robots_txt, llms_txt = _plain_text(robots), _plain_text(llms)

    declared = re.findall(r"(?im)^\s*sitemap:\s*(\S+)", robots_txt or "")
    sitemap_url = declared[0] if declared else f"{origin}/sitemap.xml"
    sitemap = await fetch_optional(client, sitemap_url, max_bytes=2 * 1024 * 1024)
    sitemap_ok = bool(sitemap and sitemap.status == 200 and re.search(r"<(urlset|sitemapindex)", sitemap.text[:5000]))
    return SiteFiles(
        origin=origin,
        robots_txt=robots_txt,
        sitemap_url=sitemap_url if sitemap_ok else None,
        sitemap_ok=sitemap_ok,
        sitemap_url_count=sitemap.text.count("<loc>") if sitemap_ok else 0,
        llms_txt=llms_txt,
    )


def _enrich(result: ModuleResult, page, site: SiteFiles) -> None:
    """Smart prioritization + one-click fix code on every open issue; one bad builder never drops the module."""
    for check in result.checks:
        annotate(check)
        try:
            check.snippet = snippet_for(check, page, site)
        except Exception:  # noqa: BLE001 - a snippet is a bonus, never a reason to fail the audit
            check.snippet = None


async def audit_once(raw_url: str, mode: str = "full") -> AuditReport:
    """Runs a fresh audit to completion (no cache). Raises AuditError with the user-facing reason."""
    async for event in run_audit(raw_url, use_cache=False, mode=mode):
        if event["type"] == "error":
            raise AuditError(event["message"])
        if event["type"] == "result":
            return AuditReport.model_validate(event["report"])
    raise AuditError("The audit did not complete.")


async def run_audit(raw_url: str, use_cache: bool = True, mode: str = "full") -> AsyncIterator[dict]:
    """mode="full": every module. mode="light": fetch-only SEO/AEO/GEO rules, with no PageSpeed, browser,
    DataForSEO or LLM calls, cheap enough for scheduled monitoring and anonymous previews."""
    try:
        url = normalize_url(raw_url)
    except AuditError as exc:
        yield {"type": "error", "message": str(exc)}
        return

    cache_key = f"{mode}:{url}"
    cached = _cache.get(cache_key)
    if use_cache and cached and time.time() - cached[0] < CACHE_TTL:
        yield {"type": "result", "report": cached[1].model_dump(), "cached": True}
        return

    yield {"type": "stage", "stage": "fetch", "status": "running"}
    async with make_client() as client:
        try:
            fetched = await fetch(client, url)
        except AuditError as exc:
            yield {"type": "error", "message": str(exc)}
            return
        if fetched.status >= 400:
            yield {"type": "error", "message": f"The site returned HTTP {fetched.status}. Check the URL is publicly reachable."}
            return
        if "html" not in fetched.headers.get("content-type", "text/html"):
            yield {"type": "error", "message": "That URL isn't an HTML page."}
            return

        parsed = urlparse(fetched.final_url)
        origin = f"{parsed.scheme}://{parsed.netloc}"
        page = parse_page(fetched.final_url, fetched.text)
        site = await _site_files(client, origin)
        yield {"type": "stage", "stage": "fetch", "status": "done"}

        async def aeo() -> ModuleResult:
            return analyze_aeo(page)

        light = mode == "light"
        tasks = [
            asyncio.create_task(analyze_seo(client, page, fetched, site)),
            asyncio.create_task(aeo()),
            asyncio.create_task(analyze_geo(page, site, probes=not light)),
        ]
        if not light:
            tasks += [
                asyncio.create_task(analyze_performance(fetched.final_url)),
                asyncio.create_task(analyze_accessibility(fetched.final_url)),
                asyncio.create_task(analyze_traffic(parsed.hostname or "")),
            ]
        modules: dict[str, ModuleResult] = {}
        for done in asyncio.as_completed(tasks):
            try:
                result = await done
            except Exception as exc:  # one failing module must not sink the whole audit
                yield {"type": "warning", "message": f"A module failed ({exc.__class__.__name__})."}
                continue
            _enrich(result, page, site)
            modules[result.key] = result
            yield {"type": "module", "module": result.model_dump()}

    report = AuditReport(
        url=url,
        final_url=fetched.final_url,
        domain=parsed.hostname or "",
        fetched_at=datetime.now(timezone.utc).isoformat(),
        overall_score=overall_score(modules),
        modules=modules,
        mode=mode,
    )
    _cache[cache_key] = (time.time(), report)
    yield {"type": "result", "report": report.model_dump()}
