"""HTTP-level protections, as pure ASGI middleware so streaming responses (the audit SSE) pass through untouched.

- OriginCheck: cookie-authenticated writes must come from the Rankwise frontend (CSRF defence on top of
  SameSite=Lax). Browsers always send Sec-Fetch-Site and/or Origin on cross-site requests and scripts can't forge
  either, so a request is trusted when the browser says it is same-origin (the Next.js /api rewrite), when its
  Origin is listed in CORS_ORIGINS, or when neither header is present (not a browser, so not CSRF).
- BodyLimit: refuses request bodies over settings.max_body_bytes, by Content-Length and while streaming.
- SecurityHeaders: nosniff, no framing, no referrer, a deny-all CSP for API responses, HSTS in production, and
  no-store on responses to signed-in requests so shared caches never keep private data.
"""

from starlette.datastructures import Headers, MutableHeaders
from starlette.exceptions import HTTPException
from starlette.responses import JSONResponse

from .auth import COOKIES

UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
# called by Razorpay and CI systems, never with a session cookie; authenticated by signature / secret token
CSRF_EXEMPT = ("/api/webhooks/", "/api/hooks/")
DOCS_PATHS = ("/docs", "/redoc", "/openapi.json")


def _has_session(headers: Headers) -> bool:
    cookie = headers.get("cookie", "")
    return any(f"{name}=" in cookie for name in COOKIES)


class OriginCheck:
    def __init__(self, app, allowed_origins: list[str]):
        self.app = app
        self.allowed = {o.rstrip("/") for o in allowed_origins}

    def trusted(self, headers: Headers) -> bool:
        site, origin = headers.get("sec-fetch-site"), headers.get("origin")
        if site == "same-origin":
            return True
        if origin is not None:
            return origin.rstrip("/") in self.allowed
        return site is None

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http" and scope["method"] in UNSAFE_METHODS and not scope["path"].startswith(CSRF_EXEMPT):
            headers = Headers(scope=scope)
            if _has_session(headers) and not self.trusted(headers):
                response = JSONResponse({"detail": "This request didn't come from Rankwise. Reload the page and try again."}, status_code=403)
                return await response(scope, receive, send)
        await self.app(scope, receive, send)


class BodyLimit:
    def __init__(self, app, max_bytes: int):
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        length = Headers(scope=scope).get("content-length")
        if length is not None and (not length.isdigit() or int(length) > self.max_bytes):
            return await JSONResponse({"detail": "Request body too large."}, status_code=413)(scope, receive, send)
        received = 0

        async def limited_receive():
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_bytes:  # chunked upload without (or lying about) Content-Length
                    raise HTTPException(413, "Request body too large.")
            return message

        await self.app(scope, limited_receive, send)


class SecurityHeaders:
    def __init__(self, app, hsts: bool):
        self.app = app
        self.hsts = hsts

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        signed_in = _has_session(Headers(scope=scope))
        docs = scope["path"].startswith(DOCS_PATHS)  # Swagger UI loads its own scripts (development only)

        async def send_with_headers(message):
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                defaults = {
                    "X-Content-Type-Options": "nosniff",
                    "X-Frame-Options": "DENY",
                    "Referrer-Policy": "no-referrer",
                }
                if not docs:
                    defaults["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
                if self.hsts:
                    defaults["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
                if signed_in:
                    defaults["Cache-Control"] = "no-store"
                for key, value in defaults.items():
                    if key not in headers:
                        headers[key] = value
            await send(message)

        await self.app(scope, receive, send_with_headers)
