"""Egress proxy: the headless browsers (Lighthouse, Accessibility / Visual Doctor) can't reach private networks.

Unit tests drive the proxy directly with fake DNS. The browser tests start a local "internal service" on
127.0.0.1 and check that a page can't load it through the proxy, with a control run proving the same page
reaches it without the proxy. They skip when no Chrome/Edge (or Lighthouse CLI) is installed.
"""

import asyncio
import shutil

import pytest

import app.egress as egress
import app.fetcher as fetcher
import app.performance as performance
from app.config import settings
from app.egress import EgressProxy, _split_host_port

PUBLIC_IP = "93.184.216.34"
REAL_OPEN = asyncio.open_connection  # the test talks to the proxy directly; only the proxy's own dials are faked
DNS = {"public.example": [PUBLIC_IP], "evil.example": ["10.0.0.7"], "rebind.example": [PUBLIC_IP, "127.0.0.1"]}


@pytest.fixture
def fake_dns(monkeypatch):
    async def resolve(host):
        return DNS.get(host, [host])

    monkeypatch.setattr(fetcher, "_resolve", resolve)


@pytest.fixture
def upstream(monkeypatch):
    """Stands in for the public internet: dials to PUBLIC_IP land on a local echo server; records every dial."""
    dials: list[tuple[str, int]] = []
    received: list[bytes] = []
    real_open = asyncio.open_connection
    state = {}

    async def echo(reader, writer):
        data = await reader.read(65536)
        received.append(data)
        writer.write(b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nok" if data.startswith(b"GET") else b"echo:" + data)
        await writer.drain()
        writer.close()

    async def fake_open(host, port, *args, **kwargs):
        dials.append((host, port))
        if host == PUBLIC_IP:
            return await real_open("127.0.0.1", state["port"])
        return await real_open(host, port, *args, **kwargs)

    async def start():
        server = await asyncio.start_server(echo, "127.0.0.1", 0)
        state["port"] = server.sockets[0].getsockname()[1]
        return server

    monkeypatch.setattr(egress.asyncio, "open_connection", fake_open)
    return start, dials, received


async def _send(proxy: EgressProxy, raw: bytes) -> bytes:
    reader, writer = await REAL_OPEN("127.0.0.1", proxy.port)
    writer.write(raw)
    await writer.drain()
    reply = await asyncio.wait_for(reader.read(65536), 5)
    if reply.startswith(b"HTTP/1.1 200 Connection Established"):
        writer.write(b"hello")
        await writer.drain()
        reply += await asyncio.wait_for(reader.read(65536), 5)
    writer.close()
    return reply


@pytest.mark.parametrize("authority, expected", [
    ("example.com:443", ("example.com", 443)), ("example.com", ("example.com", 443)), ("[::1]:8443", ("::1", 8443)), ("[2001:db8::1]", ("2001:db8::1", 443)),
])
def test_authority_parsing(authority, expected):
    assert _split_host_port(authority, 443) == expected


@pytest.mark.parametrize("authority", ["example.com:0", "example.com:99999", "example.com:x"])
def test_bad_ports_are_rejected(authority):
    with pytest.raises(ValueError):
        _split_host_port(authority, 443)


@pytest.mark.parametrize("request_line", [
    b"CONNECT evil.example:443 HTTP/1.1",  # resolves to a private address
    b"CONNECT rebind.example:443 HTTP/1.1",  # any private answer refuses the host
    b"CONNECT 127.0.0.1:5432 HTTP/1.1",  # the local database
    b"CONNECT [::1]:443 HTTP/1.1",
    b"CONNECT 169.254.169.254:80 HTTP/1.1",  # cloud metadata
    b"GET http://169.254.169.254/latest/meta-data/ HTTP/1.1",
    b"GET http://[::ffff:127.0.0.1]:8000/ HTTP/1.1",
    b"GET ftp://public.example/ HTTP/1.1",
])
def test_private_targets_are_refused_without_dialing(fake_dns, upstream, request_line):
    _, dials, _ = upstream

    async def run():
        async with EgressProxy() as proxy:
            reply = await _send(proxy, request_line + b"\r\nHost: x\r\n\r\n")
        return reply, proxy.blocked

    reply, blocked = asyncio.run(run())
    assert reply.split(b"\r\n")[0] in (b"HTTP/1.1 403 Forbidden", b"HTTP/1.1 400 Bad Request")
    assert dials == [] and blocked


def test_https_tunnel_goes_to_the_checked_address(fake_dns, upstream):
    start, dials, received = upstream

    async def run():
        server = await start()
        async with server, EgressProxy() as proxy:
            return await _send(proxy, b"CONNECT public.example:443 HTTP/1.1\r\nHost: public.example:443\r\n\r\n")

    reply = asyncio.run(run())
    assert reply.startswith(b"HTTP/1.1 200 Connection Established") and reply.endswith(b"echo:hello")
    assert dials == [(PUBLIC_IP, 443)]  # the vetted IP, not a second lookup


def test_plain_http_is_forwarded_one_request_per_connection(fake_dns, upstream):
    start, dials, received = upstream

    async def run():
        server = await start()
        async with server, EgressProxy() as proxy:
            return await _send(proxy, b"GET http://public.example/a?b=1 HTTP/1.1\r\nHost: public.example\r\nProxy-Authorization: Basic eA==\r\n"
                                      b"Proxy-Connection: keep-alive\r\nAccept: */*\r\n\r\n")

    reply = asyncio.run(run())
    assert reply.endswith(b"ok") and dials == [(PUBLIC_IP, 80)]
    sent = received[0].decode()
    assert sent.startswith("GET /a?b=1 HTTP/1.1\r\n")
    assert "Proxy-Authorization" not in sent and "Proxy-Connection" not in sent and "Connection: close" in sent


# ---------- real browsers ----------

class Internal:
    """A pretend internal service (think 169.254.169.254 or the database admin) on loopback that counts hits."""

    def __init__(self):
        self.hits = 0

    async def __aenter__(self):
        async def handle(reader, writer):
            self.hits += 1
            await reader.read(4096)
            writer.write(b"HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nAccess-Control-Allow-Origin: *\r\nContent-Length: 6\r\n\r\nsecret")
            await writer.drain()
            writer.close()

        self.server = await asyncio.start_server(handle, "127.0.0.1", 0)
        self.url = f"http://127.0.0.1:{self.server.sockets[0].getsockname()[1]}/"
        return self

    async def __aexit__(self, *_):
        self.server.close()


browser_path = performance._browser_path()
needs_browser = pytest.mark.skipif(not browser_path, reason="no local Chrome/Edge")


@needs_browser
def test_browser_cannot_reach_loopback_through_the_proxy():
    from playwright.async_api import async_playwright

    async def visit(use_proxy: bool) -> int:
        async with Internal() as internal, EgressProxy() as proxy, async_playwright() as pw:
            options = {"proxy": {"server": proxy.url, "bypass": "<-loopback>"}, "args": proxy.chrome_flags()[2:]} if use_proxy else {}
            browser = await pw.chromium.launch(executable_path=browser_path, headless=True, **options)
            try:
                try:
                    await (await browser.new_page()).goto(internal.url, timeout=10_000)  # a redirect or link to the internal address
                except Exception:
                    pass
                page = await browser.new_page()
                await page.set_content(f'<img src="{internal.url}img"><iframe src="{internal.url}frame"></iframe>')
                await page.evaluate("u => fetch(u).catch(() => null)", internal.url + "fetch")
                await page.wait_for_timeout(1000)
            finally:
                await browser.close()
            return internal.hits

    assert asyncio.run(visit(use_proxy=False)) > 0  # control: the same page does reach it without the proxy
    assert asyncio.run(visit(use_proxy=True)) == 0


@needs_browser
@pytest.mark.skipif(not shutil.which("lighthouse"), reason="no Lighthouse CLI")
def test_local_lighthouse_cannot_reach_loopback(monkeypatch):
    monkeypatch.setattr(performance, "settings", type(settings)(**{**settings.__dict__, "local_lighthouse": True}))

    async def run():
        async with Internal() as internal:
            await performance.run_local_lighthouse(internal.url)
            return internal.hits

    assert asyncio.run(run()) == 0
