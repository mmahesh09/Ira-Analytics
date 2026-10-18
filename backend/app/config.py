import os
from dataclasses import dataclass, field

from dotenv import load_dotenv

load_dotenv()


def _list(name: str, default: str) -> list[str]:
    return [item.strip() for item in os.getenv(name, default).split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    cors_origins: list[str] = field(default_factory=lambda: _list("CORS_ORIGINS", "http://localhost:3000"))
    pagespeed_api_key: str = os.getenv("PAGESPEED_API_KEY", "")
    openrouter_api_key: str = os.getenv("OPENROUTER_API_KEY", "")
    geo_models: list[str] = field(default_factory=lambda: _list("GEO_MODELS", "perplexity/sonar,openai/gpt-4o-mini"))
    # AI Content Optimization rewrites (any OpenRouter model id); defaults to the last GEO model
    content_model: str = os.getenv("CONTENT_MODEL", "") or _list("GEO_MODELS", "perplexity/sonar,openai/gpt-4o-mini")[-1]
    dataforseo_login: str = os.getenv("DATAFORSEO_LOGIN", "")
    dataforseo_password: str = os.getenv("DATAFORSEO_PASSWORD", "")
    rate_limit_per_10min: int = int(os.getenv("RATE_LIMIT_PER_10MIN", "10"))

    database_url: str = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/rankwise")
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

    user_agent: str ="Mozilla/5.0 (compatible; RankwiseAuditBot/1.0)"
    max_page_bytes: int = 3 * 1024 * 1024
    request_timeout: float = 15.0
    max_redirects: int = 5
    max_link_checks: int = 25


settings = Settings()
