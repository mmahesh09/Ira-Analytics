"""One-Click Fix Suggestions: ready-to-paste code for an open issue, built from the audited page itself.

Everything taken from the page is escaped for where it lands (HTML attribute, JSON-LD inside <script>),
and anything we can't know is left as an obvious TODO rather than invented.
"""

import json
from collections.abc import Callable
from html import escape
from urllib.parse import urlparse

from .common import SiteFiles
from .geo import AI_CRAWLERS, _brand, _crawler_access
from .models import Check, Snippet
from .page import QUESTION_RE, Page


def _clip(text: str, limit: int) -> str:
    """Trims at a word boundary so suggestions never end mid-word."""
    text = " ".join(text.split())
    if len(text) <= limit:
        return text
    cut = text[: limit + 1].rsplit(" ", 1)[0].rstrip(",;:-–— ")
    return cut or text[:limit]


def _jsonld(data: dict) -> str:
    # "</" would close the <script> early when page text contains it
    body = json.dumps(data, indent=2, ensure_ascii=False).replace("</", "<\\/")
    return f'<script type="application/ld+json">\n{body}\n</script>'


def _clean_url(page: Page) -> str:
    parts = urlparse(page.url)
    return f"{parts.scheme}://{parts.netloc}{parts.path or '/'}"


def _origin(page: Page) -> str:
    parts = urlparse(page.url)
    return f"{parts.scheme}://{parts.netloc}"


def _description(page: Page) -> str:
    current = page.meta.get("description", "").strip()
    return _clip(current or page.text, 155)


def _title(page: Page) -> Snippet:
    brand = _brand(page)
    current = page.title.strip()
    if current and len(current) > 60:
        suggestion = _clip(current, 60)
    elif current:
        suggestion = f"{current} | {brand}" if brand.lower() not in current.lower() else f"TODO: main keyword · {current}"
    else:
        suggestion = f"TODO: what this page offers | {brand}"
    return Snippet(lang="html", file="<head>", code=f"<title>{escape(suggestion)}</title>")


def _meta_description(page: Page) -> Snippet:
    return Snippet(lang="html", file="<head>", code=f'<meta name="description" content="{escape(_description(page))}">')


def _canonical(page: Page) -> Snippet:
    return Snippet(lang="html", file="<head>", code=f'<link rel="canonical" href="{escape(_clean_url(page))}">')


def _lang(page: Page) -> Snippet:
    return Snippet(lang="html", file="<html>", code='<html lang="en">  <!-- use your page\'s language code -->')


def _viewport(page: Page) -> Snippet:
    return Snippet(lang="html", file="<head>", code='<meta name="viewport" content="width=device-width, initial-scale=1">')


def _favicon(page: Page) -> Snippet:
    return Snippet(lang="html", file="<head>", code='<link rel="icon" href="/favicon.ico" sizes="any">\n<link rel="icon" href="/icon.svg" type="image/svg+xml">')


def _open_graph(page: Page) -> Snippet:
    title = escape(_clip(page.title or _brand(page), 70))
    lines = [
        f'<meta property="og:title" content="{title}">',
        f'<meta property="og:description" content="{escape(_description(page))}">',
        f'<meta property="og:url" content="{escape(_clean_url(page))}">',
        '<meta property="og:type" content="website">',
        '<meta property="og:image" content="TODO: absolute URL of a 1200×630 image">',
    ]
    return Snippet(lang="html", file="<head>", code="\n".join(lines))


def _h1(page: Page) -> Snippet:
    h1s = [t for level, t in page.headings if level == 1]
    text = h1s[0] if h1s else _clip(page.title.split("|")[0], 70) or "TODO: what this page is about"
    note = "\n<!-- change any other <h1> on the page to <h2> -->" if len(h1s) > 1 else ""
    return Snippet(lang="html", file="<body>", code=f"<h1>{escape(text)}</h1>{note}")


def _img_alt(page: Page) -> Snippet | None:
    missing = [img for img in page.images if not (img.get("alt") or "").strip() and img.get("src")][:3]
    if not missing:
        return None
    lines = [f'<img src="{escape(img["src"])}" alt="TODO: describe what this image shows">' for img in missing]
    return Snippet(lang="html", file="<body>", code="\n".join(lines))


def _ai_crawlers(page: Page, site: SiteFiles) -> Snippet | None:
    blocked = [c["bot"] for c in _crawler_access(site, page.url) if not c["allowed"]]
    if not blocked:
        return None
    blocks = [f"User-agent: {bot}\nAllow: /" for bot in blocked]
    return Snippet(lang="text", file="robots.txt", code="# let AI assistants read and cite the site\n" + "\n\n".join(blocks))


def _robots(page: Page, site: SiteFiles) -> Snippet:
    lines = ["User-agent: *", "Allow: /", ""] + [f"User-agent: {bot}\nAllow: /\n" for bot in AI_CRAWLERS]
    lines.append(f"Sitemap: {_origin(page)}/sitemap.xml")
    return Snippet(lang="text", file="robots.txt", code="\n".join(lines))


def _sitemap(page: Page) -> Snippet:
    urls = [_clean_url(page)] + [u for u in dict.fromkeys(page.internal_links) if u.startswith(_origin(page))][:9]
    body = "\n".join(f"  <url><loc>{escape(u)}</loc></url>" for u in dict.fromkeys(urls))
    code = f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{body}\n</urlset>'
    return Snippet(lang="xml", file="sitemap.xml", code=code)


def _llms_txt(page: Page) -> Snippet:
    brand = _brand(page)
    sections = [t for level, t in page.headings if level == 2][:6]
    lines = [f"# {brand}", "", f"> {_description(page)}", "", "## Key pages", "", f"- [{_clip(page.title or brand, 80)}]({_clean_url(page)}): TODO one line on what it covers"]
    if sections:
        lines += ["", "## Topics on this page", ""] + [f"- {s}" for s in sections]
    return Snippet(lang="markdown", file="llms.txt", code="\n".join(lines))


def _organization(page: Page) -> Snippet:
    data = {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": _brand(page),
        "url": _origin(page),
        "logo": f"{_origin(page)}/TODO-logo.png",
        "sameAs": ["TODO: https://www.linkedin.com/company/…", "TODO: https://x.com/…"],
    }
    return Snippet(lang="html", file="<head>", code=_jsonld(data))


def _faq(page: Page) -> Snippet | None:
    entities = []
    for heading in page.soup.find_all(["h2", "h3", "h4"]):
        question = heading.get_text(" ", strip=True)
        if not (question.endswith("?") or QUESTION_RE.match(question)):
            continue
        answer = heading.find_next(["p", "li", "dd"])
        text = _clip(answer.get_text(" ", strip=True), 300) if answer else ""
        entities.append({
            "@type": "Question",
            "name": question[:200],
            "acceptedAnswer": {"@type": "Answer", "text": text or "TODO: a 40–60 word answer"},
        })
        if len(entities) == 8:
            break
    if not entities:
        return None
    return Snippet(lang="html", file="<head>", code=_jsonld({"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": entities}))


def _breadcrumbs(page: Page) -> Snippet | None:
    segments = [s for s in urlparse(page.url).path.split("/") if s]
    if not segments:
        return None
    items, path = [{"@type": "ListItem", "position": 1, "name": "Home", "item": _origin(page) + "/"}], ""
    for i, seg in enumerate(segments, start=2):
        path += f"/{seg}"
        items.append({"@type": "ListItem", "position": i, "name": seg.replace("-", " ").capitalize(), "item": _origin(page) + path})
    return Snippet(lang="html", file="<head>", code=_jsonld({"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": items}))


# check id → builder; builders that need site files take (page, site)
_PAGE_BUILDERS: dict[str, Callable[[Page], Snippet | None]] = {
    "title": _title, "meta-description": _meta_description, "canonical": _canonical, "lang": _lang,
    "viewport": _viewport, "favicon": _favicon, "open-graph": _open_graph, "h1": _h1, "img-alt": _img_alt,
    "sitemap": _sitemap, "llms-txt": _llms_txt, "structured-data": _organization, "entity": _organization,
    "entity-schema": _organization, "answer-schema": _faq, "breadcrumbs": _breadcrumbs,
}
_SITE_BUILDERS: dict[str, Callable[[Page, SiteFiles], Snippet | None]] = {"ai-crawlers": _ai_crawlers, "robots-txt": _robots}


def snippet_for(check: Check, page: Page, site: SiteFiles) -> Snippet | None:
    """Code for an open issue, or None when there is nothing safe to generate."""
    if check.status not in ("fail", "warn"):
        return None
    if check.id in _SITE_BUILDERS:
        return _SITE_BUILDERS[check.id](page, site)
    builder = _PAGE_BUILDERS.get(check.id)
    return builder(page) if builder else None
