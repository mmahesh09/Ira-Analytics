"""Outbound HTTP for audits, guarded against SSRF (private / internal targets)."""

import asyncio
import ipaddress
import socket
import time
from dataclasses import dataclass
from urllib.parse import urljoin, urlparse, urlunparse

import httpx

from .config import settings


class AuditError(Exception):
    """A user-facing error (bad URL, unreachable site, blocked target)."""


@dataclass
class FetchResult:
    url: str
    final_url: str
    status: int
    headers: httpx.Headers
    text: str
    elapsed_ms: int
    size_bytes: int
    redirects: int


def normalize_url(raw: str) -> str:
    raw = raw.strip()
    if "://" not in raw:
        raw = "https://" + raw
    parsed = urlparse(raw)
    if parsed.scheme not in ("http", "https"):
        raise AuditError("Only http and https URLs can be audited.")
    if not parsed.hostname or "." not in parsed.hostname:
        raise AuditError("Enter a full domain, like example.com.")
    if parsed.username or parsed.password:
        raise AuditError("URLs with credentials are not allowed.")
    return urlunparse(parsed._replace(fragment="", path=parsed.path or "/"))


async def _assert_public_host(host: str) -> None:
    try:
        infos = await asyncio.get_running_loop().getaddrinfo(host, None, type=socket.SOCK_STREAM)
    except socket.gaierror:
        raise AuditError(f"Could not resolve {host}. Check the domain is spelled correctly.")
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if not ip.is_global or ip.is_multicast:
            raise AuditError("That address points to a private or reserved network and can't be audited.")


def make_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        timeout=settings.request_timeout,
        follow_redirects=False,
        headers={"User-Agent": settings.user_agent, "Accept-Language": "en"},
    )


async def fetch(client: httpx.AsyncClient, url: str, *, max_bytes: int | None = None) -> FetchResult:
    """Fetch a URL, validating every redirect hop against private networks."""
    max_bytes = max_bytes or settings.max_page_bytes
    current = url
    started = time.perf_counter()
    for hop in range(settings.max_redirects + 1):
        parsed = urlparse(current)
        if parsed.scheme not in ("http", "https") or not parsed.hostname:
            raise AuditError("Redirected to an unsupported URL.")
        await _assert_public_host(parsed.hostname)
        try:
            async with client.stream("GET", current) as resp:
                if resp.is_redirect and "location" in resp.headers:
                    current = urljoin(current, resp.headers["location"])
                    continue
                body = bytearray()
                async for chunk in resp.aiter_bytes():
                    body.extend(chunk)
                    if len(body) > max_bytes:
                        break
                return FetchResult(
                    url=url,
                    final_url=current,
                    status=resp.status_code,
                    headers=resp.headers,
                    text=body.decode(resp.encoding or "utf-8", errors="replace"),
                    elapsed_ms=int((time.perf_counter() - started) * 1000),
                    size_bytes=len(body),
                    redirects=hop,
                )
        except httpx.TimeoutException:
            raise AuditError(f"{parsed.hostname} took too long to respond.")
        except httpx.HTTPError as exc:
            raise AuditError(f"Could not connect to {parsed.hostname} ({exc.__class__.__name__}).")
    raise AuditError("Too many redirects.")


async def fetch_optional(client: httpx.AsyncClient, url: str, max_bytes: int = 512 * 1024) -> FetchResult | None:
    """Fetch a secondary resource (robots.txt, sitemap); None on any failure."""
    try:
        return await fetch(client, url, max_bytes=max_bytes)
    except AuditError:
        return None


async def check_status(client: httpx.AsyncClient, url: str) -> int | None:
    try:
        return (await fetch(client, url, max_bytes=1024)).status
    except AuditError:
        return None
