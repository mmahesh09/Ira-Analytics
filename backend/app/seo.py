import asyncio

import httpx

from .common import SiteFiles, score_checks, summarize
from .config import settings
from .fetcher import FetchResult, check_status
from .models import Check, ModuleResult
from .page import Page


def _length_check(cid: str, label: str, value: str, lo: int, hi: int, weight: int, fix_missing: str) -> Check:
    n = len(value)
    if not n:
        return Check(id=cid, title=f"{label} is missing", status="fail", weight=weight, fix=fix_missing)
    if lo <= n <= hi:
        return Check(id=cid, title=f"{label} length is ideal", status="pass", weight=weight, detail=f"{n} characters: “{value[:160]}”")
    side = "short" if n < lo else "long"
    return Check(
        id=cid,
        title=f"{label} is too {side}",
        status="warn",
        weight=weight,
        detail=f"{n} characters (aim for {lo}–{hi}): “{value[:160]}”",
        fix=f"Rewrite the {label.lower()} to {lo}–{hi} characters so it isn't {'truncated' if side == 'long' else 'too thin'} in results.",
    )


async def _broken_links(client: httpx.AsyncClient, links: list[str]) -> list[tuple[str, int | None]]:
    sample = links[: settings.max_link_checks]
    statuses = await asyncio.gather(*(check_status(client, link) for link in sample))
    return [(link, status) for link, status in zip(sample, statuses) if status is None or status >= 400]


async def analyze_seo(client: httpx.AsyncClient, page: Page, fetched: FetchResult, site: SiteFiles) -> ModuleResult:
    checks: list[Check] = []

    https = fetched.final_url.startswith("https://")
    checks.append(Check(
        id="https", title="Served over HTTPS" if https else "Not served over HTTPS",
        status="pass" if https else "fail", weight=3,
        fix=None if https else "Install a TLS certificate and redirect all HTTP traffic to HTTPS.",
    ))

    checks.append(_length_check("title", "Title tag", page.title, 30, 60, 3, "Add a unique <title> of 30–60 characters that leads with the main keyword."))
    checks.append(_length_check("meta-description", "Meta description", page.meta.get("description", ""), 70, 160, 2,
                                "Add a meta description of 70–160 characters summarising the page and inviting the click."))

    h1s = [t for level, t in page.headings if level == 1]
    if len(h1s) == 1:
        checks.append(Check(id="h1", title="One H1 heading", status="pass", weight=2, detail=f"“{h1s[0][:120]}”"))
    elif not h1s:
        checks.append(Check(id="h1", title="No H1 heading", status="fail", weight=2, fix="Add a single H1 that states what the page is about."))
    else:
        checks.append(Check(id="h1", title=f"{len(h1s)} H1 headings", status="warn", weight=2,
                            detail="; ".join(h[:60] for h in h1s[:4]), fix="Keep one H1 per page and demote the rest to H2."))

    skips = [(a, b) for (a, _), (b, _) in zip(page.headings, page.headings[1:]) if b > a + 1]
    checks.append(Check(
        id="heading-order", title="Heading levels are in order" if not skips else "Heading levels skip",
        status="pass" if not skips else "warn", weight=1,
        detail="" if not skips else f"Example: H{skips[0][0]} followed by H{skips[0][1]}.",
        fix=None if not skips else "Nest headings without skipping levels (H2 → H3, not H2 → H4).",
    ))

    robots_meta = (page.meta.get("robots", "") + " " + fetched.headers.get("x-robots-tag", "")).lower()
    noindex = "noindex" in robots_meta
    checks.append(Check(
        id="indexable", title="Page is indexable" if not noindex else "Page is set to noindex",
        status="fail" if noindex else "pass", weight=4,
        fix="Remove the noindex directive if this page should appear in search." if noindex else None,
    ))

    checks.append(Check(
        id="canonical", title="Canonical URL set" if page.canonical else "No canonical URL",
        status="pass" if page.canonical else "warn", weight=1, detail=page.canonical or "",
        fix=None if page.canonical else 'Add <link rel="canonical"> pointing to the preferred URL to avoid duplicate content.',
    ))

    viewport = "viewport" in page.meta
    checks.append(Check(
        id="viewport", title="Mobile viewport configured" if viewport else "No mobile viewport tag",
        status="pass" if viewport else "fail", weight=2,
        fix=None if viewport else '<meta name="viewport" content="width=device-width, initial-scale=1"> is required for mobile-first indexing.',
    ))

    checks.append(Check(
        id="lang", title="Language declared" if page.lang else "No language attribute",
        status="pass" if page.lang else "warn", weight=1, detail=page.lang or "",
        fix=None if page.lang else 'Add lang="en" (or your language) to the <html> tag.',
    ))

    og_missing = [k for k in ("og:title", "og:description", "og:image") if k not in page.meta]
    checks.append(Check(
        id="open-graph", title="Open Graph tags complete" if not og_missing else "Open Graph tags incomplete",
        status="pass" if not og_missing else "warn", weight=1,
        detail="" if not og_missing else "Missing: " + ", ".join(og_missing),
        fix=None if not og_missing else "Add og:title, og:description and og:image so shared links render a rich preview.",
    ))

    imgs = page.images
    missing_alt = [i for i in imgs if i["alt"] is None]
    if not imgs:
        checks.append(Check(id="img-alt", title="No images on page", status="info"))
    else:
        ratio = 1 - len(missing_alt) / len(imgs)
        checks.append(Check(
            id="img-alt", title=f"{round(ratio * 100)}% of images have alt text",
            status="pass" if ratio >= 0.95 else "warn" if ratio >= 0.7 else "fail", weight=2,
            detail=f"{len(missing_alt)} of {len(imgs)} images missing alt.",
            fix=None if ratio >= 0.95 else "Describe each meaningful image with alt text; use alt=\"\" for decorative ones.",
        ))

    wc = page.word_count
    checks.append(Check(
        id="content-length", title=f"{wc:,} words of content",
        status="pass" if wc >= 300 else "warn" if wc >= 120 else "fail", weight=2,
        fix=None if wc >= 300 else "Expand the page with useful, original content (300+ words) that answers searcher intent.",
    ))

    checks.append(Check(
        id="structured-data", title="Structured data found" if page.schema_types else "No structured data",
        status="pass" if page.schema_types else "warn", weight=2,
        detail=", ".join(sorted(page.schema_types)[:10]),
        fix=None if page.schema_types else "Add JSON-LD schema (Organization, WebSite, Article, Product…) to qualify for rich results.",
    ))

    checks.append(Check(
        id="robots-txt", title="robots.txt found" if site.robots_txt is not None else "No robots.txt",
        status="pass" if site.robots_txt is not None else "warn", weight=1,
        fix=None if site.robots_txt is not None else "Publish /robots.txt with crawl rules and a Sitemap: line.",
    ))

    checks.append(Check(
        id="sitemap", title="XML sitemap found" if site.sitemap_ok else "No XML sitemap",
        status="pass" if site.sitemap_ok else "warn", weight=2,
        detail=f"{site.sitemap_url} · {site.sitemap_url_count} URLs" if site.sitemap_ok else "",
        fix=None if site.sitemap_ok else "Generate /sitemap.xml and reference it in robots.txt and Search Console.",
    ))

    checks.append(Check(
        id="favicon", title="Favicon present" if page.favicon else "No favicon",
        status="pass" if page.favicon else "warn", weight=1,
        fix=None if page.favicon else "Add a favicon; Google shows it next to your result on mobile.",
    ))

    n_internal = len(page.internal_links)
    checks.append(Check(
        id="internal-links", title=f"{n_internal} internal links",
        status="pass" if n_internal >= 5 else "warn", weight=1,
        fix=None if n_internal >= 5 else "Link to related pages to help crawlers discover and rank your content.",
    ))

    broken = await _broken_links(client, page.internal_links)
    checked = min(len(page.internal_links), settings.max_link_checks)
    if checked:
        checks.append(Check(
            id="broken-links", title="No broken internal links" if not broken else f"{len(broken)} broken internal links",
            status="pass" if not broken else "fail", weight=2,
            detail=f"Checked {checked} links." + ("" if not broken else " " + ", ".join(f"{u} ({s or 'no response'})" for u, s in broken[:5])),
            fix=None if not broken else "Fix or redirect broken links; they waste crawl budget and frustrate visitors.",
        ))

    ttfb_ok = fetched.elapsed_ms < 800
    checks.append(Check(
        id="response-time", title=f"Server responded in {fetched.elapsed_ms} ms",
        status="pass" if ttfb_ok else "warn" if fetched.elapsed_ms < 1800 else "fail", weight=1,
        fix=None if ttfb_ok else "Reduce server response time with caching, a CDN, or faster hosting.",
    ))

    return ModuleResult(
        key="seo",
        score=score_checks(checks),
        summary=summarize(checks),
        checks=checks,
        data={
            "title": page.title,
            "description": page.meta.get("description", ""),
            "word_count": wc,
            "internal_links": n_internal,
            "external_links": len(page.external_links),
            "page_size_kb": round(fetched.size_bytes / 1024),
            "redirects": fetched.redirects,
            "headings": [{"level": lvl, "text": t[:140]} for lvl, t in page.headings[:40]],
        },
    )
