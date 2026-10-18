"""Generative Engine Optimization: can ChatGPT, Claude, Perplexity and Gemini read, trust and cite this site?"""

import asyncio
import json
import re
from datetime import datetime, timezone
from urllib.robotparser import RobotFileParser

import httpx

from .common import SiteFiles, score_checks, summarize
from .config import settings
from .models import Check, ModuleResult
from .page import Page

AI_CRAWLERS = {
    "GPTBot": "OpenAI (training)",
    "OAI-SearchBot": "ChatGPT search",
    "ChatGPT-User": "ChatGPT browsing",
    "ClaudeBot": "Anthropic Claude",
    "PerplexityBot": "Perplexity",
    "Google-Extended": "Gemini / AI Overviews",
    "Applebot-Extended": "Apple Intelligence",
    "CCBot": "Common Crawl",
}
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
STAT_RE = re.compile(r"\b\d+(?:[.,]\d+)?\s?(?:%|percent|x\b|million|billion)", re.I)


def _crawler_access(site: SiteFiles, url: str) -> list[dict]:
    parser = RobotFileParser()
    parser.parse((site.robots_txt or "").splitlines())
    return [{"bot": bot, "owner": owner, "allowed": parser.can_fetch(bot, url)} for bot, owner in AI_CRAWLERS.items()]


def _brand(page: Page) -> str:
    for node in page.jsonld:
        types = node.get("@type")
        types = types if isinstance(types, list) else [types]
        if {"Organization", "Corporation", "LocalBusiness", "WebSite"} & set(t for t in types if isinstance(t, str)):
            if isinstance(node.get("name"), str) and node["name"].strip():
                return node["name"].strip()
    if page.meta.get("og:site_name"):
        return page.meta["og:site_name"]
    parts = re.split(r"\s[|\-–—:·]\s", page.title)
    if len(parts) > 1 and parts[-1].strip():
        return parts[-1].strip()
    return page.host.removeprefix("www.").split(".")[0].capitalize()


def _modified_date(page: Page) -> datetime | None:
    candidates = [n.get("dateModified") or n.get("datePublished") for n in page.jsonld]
    candidates += [page.meta.get("article:modified_time"), page.meta.get("article:published_time"), page.meta.get("last-modified")]
    for value in candidates:
        if isinstance(value, str) and value:
            try:
                parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
                return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
            except ValueError:
                continue
    return None


async def _chat(client: httpx.AsyncClient, model: str, prompt: str, max_tokens: int = 500) -> dict:
    resp = await client.post(
        OPENROUTER_URL,
        headers={"Authorization": f"Bearer {settings.openrouter_api_key}", "X-Title": "Rankwise"},
        json={"model": model, "max_tokens": max_tokens, "messages": [{"role": "user", "content": prompt}]},
        timeout=45,
    )
    resp.raise_for_status()
    body = resp.json()
    return {"text": body["choices"][0]["message"]["content"] or "", "citations": body.get("citations") or []}


async def _visibility_probes(page: Page, brand: str) -> dict:
    """Ask several LLMs category questions a buyer would ask and record whether the brand shows up."""
    async with httpx.AsyncClient() as client:
        planner = await _chat(
            client,
            settings.geo_models[-1],
            "You are helping test brand visibility in AI answers. Based on this website, reply ONLY with JSON "
            '{"category": "<short market category>", "prompts": ["<q1>", "<q2>", "<q3>"]} where each prompt is a '
            "question a potential customer would ask an AI assistant when looking for this kind of product or service. "
            "Do not mention the brand in the prompts.\n\n"
            f"Brand: {brand}\nTitle: {page.title}\nDescription: {page.meta.get('description', '')}\n"
            f"Content excerpt: {page.text[:1500]}",
            max_tokens=300,
        )
        match = re.search(r"\{.*\}", planner["text"], re.S)
        plan = json.loads(match.group(0)) if match else {}
        prompts = [p for p in plan.get("prompts", []) if isinstance(p, str)][:3]
        if not prompts:
            raise ValueError("Could not generate probe prompts")

        domain_root = page.host.removeprefix("www.")
        needles = {brand.lower(), domain_root.lower(), domain_root.split(".")[0].lower()}
        needles = {n for n in needles if len(n) >= 3}

        async def probe(model: str, prompt: str) -> dict:
            try:
                answer = await _chat(client, model, prompt)
            except (httpx.HTTPError, KeyError, ValueError) as exc:
                return {"model": model, "prompt": prompt, "error": exc.__class__.__name__}
            text = answer["text"].lower()
            cited = [c for c in answer["citations"] if isinstance(c, str) and domain_root in c]
            return {
                "model": model,
                "prompt": prompt,
                "mentioned": any(n in text for n in needles),
                "cited": bool(cited),
                "excerpt": answer["text"][:400],
            }

        results = await asyncio.gather(*(probe(m, p) for p in prompts for m in settings.geo_models))
    return {"category": plan.get("category", ""), "results": list(results)}


async def analyze_geo(page: Page, site: SiteFiles) -> ModuleResult:
    checks: list[Check] = []

    crawlers = _crawler_access(site, page.url)
    blocked = [c for c in crawlers if not c["allowed"]]
    checks.append(Check(
        id="ai-crawlers",
        title="All major AI crawlers allowed" if not blocked else f"{len(blocked)} AI crawlers blocked in robots.txt",
        status="pass" if not blocked else "warn" if len(blocked) <= 3 else "fail", weight=4,
        detail=", ".join(f"{c['bot']} ({c['owner']})" for c in blocked),
        fix=None if not blocked else "Allow the AI crawlers you want to be cited by. Blocking OAI-SearchBot or PerplexityBot removes you from their answers.",
    ))

    checks.append(Check(
        id="llms-txt", title="llms.txt published" if site.llms_txt else "No llms.txt",
        status="pass" if site.llms_txt else "warn", weight=2,
        detail=f"{len(site.llms_txt.splitlines())} lines" if site.llms_txt else "",
        fix=None if site.llms_txt else "Publish /llms.txt: a Markdown index of your key pages and what they cover, written for language models.",
    ))

    ssr = page.word_count >= 150
    checks.append(Check(
        id="server-rendered", title="Content is readable without JavaScript" if ssr else "Content needs JavaScript to appear",
        status="pass" if ssr else "fail", weight=4,
        detail=f"{page.word_count} words in the raw HTML.",
        fix=None if ssr else "Most AI crawlers don't run JavaScript. Server-render or pre-render your main content.",
    ))

    org = next((n for n in page.jsonld if "Organization" in str(n.get("@type"))), None)
    same_as = org.get("sameAs") if org else None
    checks.append(Check(
        id="entity", title="Brand entity is defined with sameAs links" if same_as else "Brand entity is weakly defined",
        status="pass" if same_as else "warn" if org else "fail", weight=3,
        fix=None if same_as else "Add Organization JSON-LD with name, logo, and sameAs links (LinkedIn, Wikipedia, Crunchbase) so models can resolve who you are.",
    ))

    author = page.meta.get("author") or any(n.get("author") for n in page.jsonld)
    checks.append(Check(
        id="authorship", title="Authorship is declared" if author else "No author information",
        status="pass" if author else "warn", weight=2,
        fix=None if author else "Show a named author with credentials and mark them up in schema; models weigh expertise signals.",
    ))

    modified = _modified_date(page)
    if modified:
        age_days = (datetime.now(timezone.utc) - modified).days
        checks.append(Check(
            id="freshness", title=f"Updated {age_days} days ago",
            status="pass" if age_days <= 365 else "warn", weight=2,
            fix=None if age_days <= 365 else "Refresh this content; generative engines prefer recent sources.",
        ))
    else:
        checks.append(Check(id="freshness", title="No published or modified date", status="warn", weight=2,
                            fix="Expose dateModified in schema and on the page so engines can judge freshness."))

    stats = len(STAT_RE.findall(page.text))
    checks.append(Check(
        id="statistics", title=f"{stats} statistics or figures",
        status="pass" if stats >= 3 else "warn", weight=2,
        fix=None if stats >= 3 else "Add concrete numbers and data points; content with statistics is cited by AI answers more often.",
    ))

    sources = len(page.external_links)
    checks.append(Check(
        id="citations", title=f"{sources} outbound references",
        status="pass" if sources >= 3 else "warn", weight=1,
        fix=None if sources >= 3 else "Cite reputable sources with outbound links to strengthen trust signals.",
    ))

    brand = _brand(page)
    probes = None
    if settings.openrouter_api_key:
        try:
            probes = await _visibility_probes(page, brand)
        except (httpx.HTTPError, ValueError, KeyError, json.JSONDecodeError) as exc:
            probes = {"error": f"AI visibility probes failed ({exc.__class__.__name__})."}
        valid = [r for r in probes.get("results", []) if "error" not in r]
        if valid:
            share = sum(r["mentioned"] for r in valid) / len(valid)
            checks.append(Check(
                id="ai-visibility", title=f"Mentioned in {round(share * 100)}% of AI answers",
                status="pass" if share >= 0.5 else "warn" if share > 0 else "fail", weight=5,
                detail=f"{len(valid)} answers from {', '.join(settings.geo_models)} for “{probes.get('category', '')}” questions.",
                fix=None if share >= 0.5 else "Earn mentions on the sources models learn from: reviews, comparisons, Reddit, Wikipedia, industry lists.",
            ))
    else:
        checks.append(Check(id="ai-visibility", title="Live AI visibility test not configured", status="info",
                            detail="Add an OpenRouter API key on the server to ask real models about your category."))

    return ModuleResult(
        key="geo",
        score=score_checks(checks),
        summary=summarize(checks),
        checks=checks,
        data={"brand": brand, "crawlers": crawlers, "llms_txt": bool(site.llms_txt), "probes": probes},
    )
