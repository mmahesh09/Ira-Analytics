"""Broken Link Monitor: crawl a site's own pages and check every link on them.

Polite by design: a few pages per run (plan-limited), a small global concurrency and at most two
requests at a time per host. Every request goes through fetcher.fetch, which blocks private networks
on each redirect hop.
"""

import asyncio
import re
from collections import defaultdict
from dataclasses import dataclass
from urllib.parse import urlparse

from .fetcher import AuditError, fetch, make_client
from .page import parse_page

# Status codes sites commonly return to bots even when the page works for people: not counted as broken
BOT_BLOCKED = {401, 403, 405, 429, 999}
# only follow internal links that look like HTML pages
NON_PAGE = re.compile(r"\.(png|jpe?g|gif|webp|svg|ico|pdf|zip|mp4|mp3|css|js|xml|json|txt|woff2?)$", re.I)


@dataclass
class LinkResult:
    url: str
    source_url: str
    internal: bool
    ok: bool
    status_code: int | None
    error: str | None


def is_broken(status: int | None) -> bool:
    return status is None or (status >= 400 and status not in BOT_BLOCKED)


async def crawl_links(start_url: str, max_pages: int = 10, max_links: int = 300, concurrency: int = 6) -> tuple[list[str], list[LinkResult]]:
    """Returns (pages crawled, link results). Raises AuditError if the start page itself can't be fetched."""
    host = urlparse(start_url).hostname
    page_status: dict[str, int] = {}
    sources: dict[str, tuple[str, bool]] = {}  # link -> (first page it was seen on, internal?)
    queue, crawled = [start_url], []

    async with make_client() as client:
        while queue and len(crawled) < max_pages:
            url = queue.pop(0)
            if url in page_status:
                continue
            try:
                res = await fetch(client, url)
            except AuditError:
                if not crawled:
                    raise
                page_status[url] = 0
                continue
            page_status[url] = res.status
            crawled.append(url)
            if res.status >= 400 or "html" not in res.headers.get("content-type", "text/html"):
                continue
            page = parse_page(res.final_url, res.text)
            for link in page.internal_links:
                sources.setdefault(link, (url, True))
                if urlparse(link).hostname == host and not NON_PAGE.search(urlparse(link).path) and link not in page_status:
                    queue.append(link)
            for link in page.external_links:
                sources.setdefault(link, (url, False))

        global_slot = asyncio.Semaphore(concurrency)
        host_slots: dict[str, asyncio.Semaphore] = defaultdict(lambda: asyncio.Semaphore(2))

        async def check(link: str) -> LinkResult:
            source, internal = sources[link]
            if link in page_status and page_status[link]:
                status = page_status[link]
                return LinkResult(link, source, internal, not is_broken(status), status, None)
            async with global_slot, host_slots[urlparse(link).hostname or ""]:
                try:
                    status = (await fetch(client, link, max_bytes=1024)).status
                    error = None
                except AuditError as exc:
                    status, error = None, str(exc)[:300]
            return LinkResult(link, source, internal, not is_broken(status), status, error)

        # share the cap so a big site's internal links can't crowd out every external one
        internal = [u for u, (_, inside) in sources.items() if inside]
        external = [u for u, (_, inside) in sources.items() if not inside]
        ext_quota = min(len(external), max(max_links - len(internal), int(max_links * 0.3)))
        links = internal[: max_links - ext_quota] + external[:ext_quota]
        results = await asyncio.gather(*(check(link) for link in links))
    return crawled, list(results)
