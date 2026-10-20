"""Local egress proxy for the headless browsers (Lighthouse and the Accessibility / Visual Doctor visit).

A page the user asks us to audit controls what the browser loads: redirects, scripts, iframes, fetches. Each
browser is started with this proxy as its only route out, so every connection passes the fetcher's
private-network check and goes to the exact address that was checked. The browser never resolves names itself
(the proxy does), which also closes DNS rebinding. Plain HTTP is forwarded one request per connection; HTTPS
and WebSockets are tunnelled with CONNECT.

    async with EgressProxy() as proxy:
        chrome_flags = proxy.chrome_flags()
"""

import asyncio
import logging
from contextlib import suppress
from urllib.parse import urlsplit

from .fetcher import AuditError, _assert_public_host

log = logging.getLogger("rankwise.egress")
MAX_HEAD = 32 * 1024
CONNECT_TIMEOUT = 15
HOP_HEADERS = {"proxy-connection", "proxy-authorization", "connection", "keep-alive"}


def _split_host_port(authority: str, default_port: int) -> tuple[str, int]:
    if authority.startswith("["):  # [IPv6]:port
        host, _, rest = authority[1:].partition("]")
        port = rest.removeprefix(":")
    elif authority.count(":") == 1:
        host, _, port = authority.partition(":")
    else:
        host, port = authority, ""
    if not port:
        return host, default_port
    if not port.isdigit() or not 0 < int(port) < 65536:
        raise ValueError("bad port")
    return host, int(port)


async def _pipe(reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
    try:
        while data := await reader.read(65536):
            writer.write(data)
            await writer.drain()
    except (ConnectionError, OSError):
        pass
    finally:
        with suppress(Exception):
            writer.close()


class EgressProxy:
    def __init__(self) -> None:
        self.server: asyncio.Server | None = None
        self.port = 0
        self.blocked: list[str] = []  # targets refused during this run (for logs and tests)

    async def __aenter__(self) -> "EgressProxy":
        self.server = await asyncio.start_server(self._handle, "127.0.0.1", 0, limit=MAX_HEAD)
        self.port = self.server.sockets[0].getsockname()[1]
        return self

    async def __aexit__(self, *_) -> None:
        if self.server:
            self.server.close()
            with suppress(Exception):
                await asyncio.wait_for(self.server.wait_closed(), 5)
        if self.blocked:
            log.info("egress proxy blocked %d request(s) to private or invalid hosts", len(self.blocked))

    @property
    def url(self) -> str:
        return f"http://127.0.0.1:{self.port}"

    def chrome_flags(self) -> list[str]:
        """Chromium flags that send all traffic through the proxy, loopback included, and leave no side channel:
        QUIC (UDP) and WebRTC UDP don't use HTTP proxies, so they are switched off."""
        return [
            f"--proxy-server={self.url}",
            "--proxy-bypass-list=<-loopback>",
            "--disable-quic",
            "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
        ]

    async def _dial(self, host: str, port: int) -> tuple[asyncio.StreamReader, asyncio.StreamWriter]:
        ip = await _assert_public_host(host)  # refuses private, loopback, link-local, metadata, NAT64-embedded...
        return await asyncio.wait_for(asyncio.open_connection(ip, port), CONNECT_TIMEOUT)

    async def _refuse(self, writer: asyncio.StreamWriter, target: str, status: str = "403 Forbidden") -> None:
        self.blocked.append(target)
        writer.write(f"HTTP/1.1 {status}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".encode())
        with suppress(Exception):
            await writer.drain()
            writer.close()

    async def _handle(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
        try:
            head = await asyncio.wait_for(reader.readuntil(b"\r\n\r\n"), CONNECT_TIMEOUT)
        except asyncio.LimitOverrunError:
            return await self._refuse(writer, "?", "431 Request Header Fields Too Large")
        except (asyncio.IncompleteReadError, TimeoutError, ConnectionError):
            writer.close()
            return
        lines = head.decode("latin-1").split("\r\n")
        try:
            method, target, version = lines[0].split(" ", 2)
        except ValueError:
            return await self._refuse(writer, "?", "400 Bad Request")

        try:
            if method == "CONNECT":
                host, port = _split_host_port(target, 443)
                upstream_reader, upstream_writer = await self._dial(host, port)
                writer.write(b"HTTP/1.1 200 Connection Established\r\n\r\n")
                await writer.drain()
            else:
                url = urlsplit(target)
                if url.scheme != "http" or not url.hostname:
                    return await self._refuse(writer, target, "400 Bad Request")
                upstream_reader, upstream_writer = await self._dial(url.hostname, url.port or 80)
                path = (url.path or "/") + (f"?{url.query}" if url.query else "")
                headers = [line for line in lines[1:] if line and line.split(":", 1)[0].strip().lower() not in HOP_HEADERS]
                # one request per upstream connection: a reused client connection can't be steered to another host
                upstream_writer.write(f"{method} {path} {version}\r\n".encode("latin-1"))
                upstream_writer.write(("\r\n".join([*headers, "Connection: close"]) + "\r\n\r\n").encode("latin-1"))
                await upstream_writer.drain()
        except (AuditError, ValueError):
            return await self._refuse(writer, target)
        except (OSError, TimeoutError):
            return await self._refuse(writer, target, "502 Bad Gateway")

        await asyncio.gather(_pipe(reader, upstream_writer), _pipe(upstream_reader, writer))
