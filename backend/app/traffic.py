"""Estimated organic traffic and ranking keywords via DataForSEO Labs. Not part of the overall score."""

import httpx

from .config import settings
from .models import ModuleResult

DFS_BASE = "https://api.dataforseo.com/v3/dataforseo_labs/google"


async def _post(client: httpx.AsyncClient, path: str, payload: dict) -> dict | None:
    resp = await client.post(f"{DFS_BASE}/{path}", json=[payload])
    resp.raise_for_status()
    task = resp.json()["tasks"][0]
    return (task.get("result") or [None])[0]


async def analyze_traffic(domain: str) -> ModuleResult:
    if not (settings.dataforseo_login and settings.dataforseo_password):
        return ModuleResult(
            key="traffic",
            available=False,
            summary="Traffic estimates need a DataForSEO account. Add DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD on the server.",
        )

    target = domain.removeprefix("www.")
    base = {"target": target, "location_code": 2840, "language_code": "en"}
    try:
        async with httpx.AsyncClient(timeout=60, auth=(settings.dataforseo_login, settings.dataforseo_password)) as client:
            overview = await _post(client, "domain_rank_overview/live", base)
            ranked = await _post(client, "ranked_keywords/live", {**base, "limit": 15, "order_by": ["keyword_data.keyword_info.search_volume,desc"]})
    except (httpx.HTTPError, KeyError, IndexError, ValueError) as exc:
        return ModuleResult(key="traffic", available=False, summary=f"Traffic data unavailable ({exc.__class__.__name__}).")

    organic = ((overview or {}).get("items") or [{}])[0].get("metrics", {}).get("organic", {})
    keywords = []
    for item in (ranked or {}).get("items") or []:
        kd = item.get("keyword_data", {})
        serp = item.get("ranked_serp_element", {}).get("serp_item", {})
        keywords.append({
            "keyword": kd.get("keyword"),
            "volume": kd.get("keyword_info", {}).get("search_volume"),
            "position": serp.get("rank_absolute"),
            "url": serp.get("url"),
            "etv": serp.get("etv"),
        })

    positions = {
        "1": organic.get("pos_1", 0),
        "2–3": organic.get("pos_2_3", 0),
        "4–10": organic.get("pos_4_10", 0),
        "11–20": organic.get("pos_11_20", 0),
        "21–50": sum(organic.get(k, 0) for k in ("pos_21_30", "pos_31_40", "pos_41_50")),
    }
    visits = round(organic.get("etv") or 0)
    return ModuleResult(
        key="traffic",
        summary=f"About {visits:,} estimated organic visits per month in the US.",
        data={
            "estimated_monthly_visits": visits,
            "ranking_keywords": organic.get("count", 0),
            "traffic_value_usd": round(organic.get("estimated_paid_traffic_cost") or 0),
            "positions": positions,
            "top_keywords": keywords,
            "source": "DataForSEO Labs (Google US, estimated)",
        },
    )
