"""SSRF guard: audits may only reach public addresses, on every redirect hop, at the address that was checked."""

import asyncio

import httpx
import pytest

import app.fetcher as fetcher
from app.fetcher import AuditError, fetch, is_public_ip, normalize_url

DNS = {"public.example": ["93.184.216.34"], "evil.example": ["127.0.0.1"], "mixed.example": ["93.184.216.34", "10.0.0.5"]}


@pytest.fixture(autouse=True)
def fake_dns(monkeypatch):
    async def resolve(host):
        return DNS.get(host, [host])  # literal IPs resolve to themselves

    monkeypatch.setattr(fetcher, "_resolve", resolve)


def client(handler) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(handler), follow_redirects=False)


@pytest.mark.parametrize("address", [
    "127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1",
    "::1", "::", "fd00::1", "fe80::1%eth0", "::ffff:127.0.0.1", "::ffff:169.254.169.254", "64:ff9b::7f00:1", "64:ff9b::a9fe:a9fe",
])
def test_private_and_reserved_addresses_are_refused(address):
    assert not is_public_ip(address)


@pytest.mark.parametrize("address", ["93.184.216.34", "2606:2800:220:1:248:1893:25c8:1946", "64:ff9b::808:808"])
def test_public_addresses_are_allowed(address):
    assert is_public_ip(address)


@pytest.mark.parametrize("raw", ["file:///etc/passwd", "gopher://public.example", "http://user:pw@public.example/", "localhost"])
def test_unsupported_urls_are_rejected(raw):
    with pytest.raises(AuditError):
        normalize_url(raw)


def test_private_host_is_refused_before_any_request():
    sent = []
    with pytest.raises(AuditError, match="private"):
        asyncio.run(fetch(client(lambda r: sent.append(r) or httpx.Response(200)), "http://evil.example/"))
    assert sent == []


def test_any_private_answer_refuses_the_host():
    with pytest.raises(AuditError, match="private"):
        asyncio.run(fetch(client(lambda r: httpx.Response(200)), "http://mixed.example/"))


@pytest.mark.parametrize("location", ["http://evil.example/admin", "http://169.254.169.254/latest/meta-data/", "http://[::1]:8000/"])
def test_redirect_to_private_network_is_refused(location):
    with pytest.raises(AuditError, match="private"):
        asyncio.run(fetch(client(lambda r: httpx.Response(302, headers={"location": location})), "http://public.example/"))


def test_request_goes_to_the_checked_address_with_the_original_host():
    """DNS rebinding: the connection uses the vetted IP, so a second lookup can't swap in a private one."""
    seen = []

    def handler(request):
        seen.append(request)
        return httpx.Response(200, text="ok")

    result = asyncio.run(fetch(client(handler), "https://public.example:8443/page"))
    assert result.status == 200 and result.final_url == "https://public.example:8443/page"
    assert seen[0].url.host == "93.184.216.34" and seen[0].url.port == 8443
    assert seen[0].headers["host"] == "public.example:8443"
    assert seen[0].extensions["sni_hostname"] == "public.example"
