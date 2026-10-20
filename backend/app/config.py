import os
from dataclasses import dataclass, field

from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from dotenv import load_dotenv

load_dotenv()


def _list(name: str, default: str) -> list[str]:
    return [item.strip() for item in os.getenv(name, default).split(",") if item.strip()]


def async_db_url(raw: str) -> str:
    """Accepts the plain URL hosts hand out (Neon, Render, Vercel: postgres://…?sslmode=require) and returns
    the asyncpg form SQLAlchemy needs, so one DATABASE_URL works for the backend and the frontend."""
    parts = urlsplit(raw)
    if parts.scheme not in ("postgres", "postgresql", "postgresql+asyncpg"):
        return raw
    params = parse_qsl(parts.query)
    sslmode = dict(params).get("sslmode")
    # asyncpg rejects libpq-only options
    query = [(k, v) for k, v in params if k not in ("sslmode", "channel_binding")]
    if sslmode and sslmode != "disable" and "ssl" not in dict(query):
        query.append(("ssl", sslmode if sslmode in ("verify-ca", "verify-full") else "require"))
    return urlunsplit(("postgresql+asyncpg", parts.netloc, parts.path, urlencode(query), parts.fragment))


def _production() -> bool:
    return os.getenv("APP_ENV", "development").lower() == "production"


@dataclass(frozen=True)
class Settings:
    # "production" makes startup fail closed on missing or unsafe settings (problems()), hides the API docs and
    # drops development defaults such as the localhost CORS origin
    app_env: str = os.getenv("APP_ENV", "development").lower()
    # browsers call the API directly only for the audit stream. The production frontend is always allowed, so a
    # leftover CORS_ORIGINS (e.g. localhost copied from .env.example) can't lock the live site out; CORS_ORIGINS adds to it.
    # The same list is trusted as Origin for cookie-authenticated writes (security.OriginCheck).
    cors_origins: list[str] = field(
        default_factory=lambda: list(dict.fromkeys([
            *_list("CORS_ORIGINS", "" if _production() else "http://localhost:3000"),
            *_list("FRONTEND_ORIGIN", "https://rankwise-xi.vercel.app"),
        ]))
    )
    # per signed-in user per minute: all requests, and the state-changing ones (POST/PATCH/PUT/DELETE)
    user_rate_per_min: int = int(os.getenv("USER_RATE_PER_MIN", "300"))
    user_write_rate_per_min: int = int(os.getenv("USER_WRITE_RATE_PER_MIN", "60"))
    # request bodies are small JSON documents; anything bigger is refused before it is read
    max_body_bytes: int = int(os.getenv("MAX_BODY_BYTES", str(256 * 1024)))
    pagespeed_api_key: str = os.getenv("PAGESPEED_API_KEY", "")
    openrouter_api_key: str = os.getenv("OPENROUTER_API_KEY", "")
    geo_models: list[str] = field(default_factory=lambda: _list("GEO_MODELS", "perplexity/sonar,openai/gpt-4o-mini"))
    # AI Content Optimization rewrites (any OpenRouter model id); defaults to the last GEO model
    content_model: str = os.getenv("CONTENT_MODEL", "") or _list("GEO_MODELS", "perplexity/sonar,openai/gpt-4o-mini")[-1]
    dataforseo_login: str = os.getenv("DATAFORSEO_LOGIN", "")
    dataforseo_password: str = os.getenv("DATAFORSEO_PASSWORD", "")
    rate_limit_per_10min: int = int(os.getenv("RATE_LIMIT_PER_10MIN", "10"))
    # anonymous preview audits (light checks, not saved), counted in Postgres per hashed IP per UTC day
    preview_per_ip_per_day: int = int(os.getenv("PREVIEW_PER_IP_PER_DAY", "2"))
    preview_daily_cap: int = int(os.getenv("PREVIEW_DAILY_CAP", "200"))
    preview_salt: str = os.getenv("PREVIEW_SALT", "")
    # accounts that may read product feedback (/api/admin/feedback); the account's email must also be verified
    admin_emails: frozenset[str] = field(default_factory=lambda: frozenset(e.lower() for e in _list("ADMIN_EMAILS", "")))
    # public feedback form submissions per hashed IP per 10 minutes
    feedback_per_ip_per_10min: int = int(os.getenv("FEEDBACK_PER_IP_PER_10MIN", "5"))
    # proxies in front of the API that append to X-Forwarded-For (Render: 1). 0 = ignore the header entirely
    trusted_proxy_hops: int = int(os.getenv("TRUSTED_PROXY_HOPS", "0"))

    database_url: str = async_db_url(os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/rankwise"))
    # Neon Object Storage bucket for Visual Doctor screenshots (credentials come from the AWS_* variables)
    shots_bucket: str = os.getenv("SHOTS_BUCKET", "assets")
    # run the job loop inside the API process (single-container hosts such as Render's free tier)
    embedded_worker: bool = os.getenv("EMBEDDED_WORKER", "false").lower() == "true"
    public_api_url: str = os.getenv("PUBLIC_API_URL", "http://localhost:8000")

    # Razorpay subscriptions (use rzp_test_ keys in development)
    razorpay_key_id: str = os.getenv("RAZORPAY_KEY_ID", "")
    razorpay_key_secret: str = os.getenv("RAZORPAY_KEY_SECRET", "")
    razorpay_webhook_secret: str = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")
    # "pro_inr=plan_xxx,pro_usd=plan_yyy,business_inr=...,business_usd=..." (printed by scripts/create_razorpay_plans.py)
    razorpay_plans: dict[str, str] = field(
        default_factory=lambda: dict(item.split("=", 1) for item in _list("RAZORPAY_PLANS", "") if "=" in item)
    )
    # USD needs International Payments approved on the Razorpay account
    razorpay_usd_enabled: bool = os.getenv("RAZORPAY_USD_ENABLED", "false").lower() == "true"

    # Accessibility Checker + Visual Website Doctor open the page in a local headless Chrome/Edge
    browser_checks: bool = os.getenv("BROWSER_CHECKS", "true").lower() == "true"
    # Speed fallback when PageSpeed Insights is unavailable: run the Lighthouse CLI locally
    local_lighthouse: bool = os.getenv("LOCAL_LIGHTHOUSE", "true").lower() == "true"
    lighthouse_chrome_path: str = os.getenv("LIGHTHOUSE_CHROME_PATH", "")
    # containers run Chromium as root without user namespaces: it needs --no-sandbox (set by the Dockerfile)
    chrome_no_sandbox: bool = os.getenv("CHROME_NO_SANDBOX", "false").lower() == "true"

    user_agent: str ="Mozilla/5.0 (compatible; RankwiseAuditBot/1.0)"
    max_page_bytes: int = 3 * 1024 * 1024
    request_timeout: float = 15.0
    max_redirects: int = 5
    max_link_checks: int = 25

    @property
    def production(self) -> bool:
        return self.app_env == "production"

    def problems(self) -> list[str]:
        """Settings that make a production deploy unsafe. Empty outside production."""
        if not self.production:
            return []
        found = []
        if "@localhost" in self.database_url or "@127.0.0.1" in self.database_url:
            found.append("DATABASE_URL is not set (still the local default)")
        if len(self.preview_salt) < 16:
            found.append("PREVIEW_SALT must be a random string of at least 16 characters (visitor IPs are hashed with it)")
        if not self.public_api_url.startswith("https://"):
            found.append("PUBLIC_API_URL must be the public https:// URL of this API")
        if any(not o.startswith("https://") for o in self.cors_origins):
            found.append("CORS_ORIGINS / FRONTEND_ORIGIN may only list https:// origins in production")
        if self.razorpay_key_secret and not self.razorpay_webhook_secret:
            found.append("RAZORPAY_WEBHOOK_SECRET is required when Razorpay keys are set (payments would never confirm)")
        if self.trusted_proxy_hops < 1:
            found.append("TRUSTED_PROXY_HOPS must be at least 1 behind a proxy (preview and API limits key on the client IP)")
        return found


settings = Settings()
