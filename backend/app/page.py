"""Parses an HTML document once into the facts every analyzer needs."""

import json
import re
from dataclasses import dataclass, field
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

QUESTION_RE = re.compile(r"^(what|how|why|when|where|who|which|can|does|do|is|are|should|will)\b", re.I)


@dataclass
class Page:
    url: str
    host: str
    html: str
    soup: BeautifulSoup
    lang: str | None
    title: str
    meta: dict[str, str]
    canonical: str | None
    headings: list[tuple[int, str]]
    text: str
    word_count: int
    jsonld: list[dict]
    schema_types: set[str]
    internal_links: list[str]
    external_links: list[str]
    images: list[dict]
    favicon: bool
    hreflang: list[str] = field(default_factory=list)

    @property
    def question_headings(self) -> list[str]:
        return [t for level, t in self.headings if level in (2, 3, 4) and (t.endswith("?") or QUESTION_RE.match(t))]


def _flatten_jsonld(node, out: list[dict]) -> None:
    if isinstance(node, list):
        for item in node:
            _flatten_jsonld(item, out)
    elif isinstance(node, dict):
        out.append(node)
        for key in ("@graph", "mainEntity", "itemListElement"):
            if key in node:
                _flatten_jsonld(node[key], out)


def _types(node: dict) -> list[str]:
    value = node.get("@type", [])
    return value if isinstance(value, list) else [value]


def parse_page(url: str, html: str) -> Page:
    soup = BeautifulSoup(html, "lxml")
    host = urlparse(url).hostname or ""

    meta: dict[str, str] = {}
    for tag in soup.find_all("meta"):
        key = (tag.get("name") or tag.get("property") or "").lower().strip()
        if key and tag.get("content") is not None:
            meta.setdefault(key, tag["content"].strip())

    canonical_tag = soup.find("link", rel=lambda v: v and "canonical" in v)
    hreflang = [t.get("hreflang") for t in soup.find_all("link", hreflang=True)]
    favicon = bool(soup.find("link", rel=lambda v: v and "icon" in " ".join(v).lower()))

    jsonld: list[dict] = []
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            _flatten_jsonld(json.loads(script.string or ""), jsonld)
        except (json.JSONDecodeError, TypeError):
            continue
    schema_types = {t for node in jsonld for t in _types(node) if isinstance(t, str)}

    headings = [
        (int(h.name[1]), h.get_text(" ", strip=True))
        for h in soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6"])
    ]

    internal, external = [], []
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if href.startswith(("#", "mailto:", "tel:", "javascript:")):
            continue
        absolute = urljoin(url, href).split("#")[0]
        link_host = urlparse(absolute).hostname or ""
        if link_host.removeprefix("www.") == host.removeprefix("www."):
            internal.append(absolute)
        elif absolute.startswith("http"):
            external.append(absolute)

    images = [{"src": img.get("src") or img.get("data-src") or "", "alt": img.get("alt")} for img in soup.find_all("img")]

    title = soup.title.get_text(strip=True) if soup.title else ""
    lang = soup.html.get("lang") if soup.html else None

    body = BeautifulSoup(html, "lxml")
    for tag in body(["script", "style", "noscript", "svg", "template"]):
        tag.decompose()
    text = re.sub(r"\s+", " ", body.get_text(" ", strip=True))

    return Page(
        url=url,
        host=host,
        html=html,
        soup=soup,
        lang=lang,
        title=title,
        meta=meta,
        canonical=canonical_tag.get("href") if canonical_tag else None,
        headings=headings,
        text=text,
        word_count=len(text.split()),
        jsonld=jsonld,
        schema_types=schema_types,
        internal_links=list(dict.fromkeys(internal)),
        external_links=list(dict.fromkeys(external)),
        images=images,
        favicon=favicon,
        hreflang=hreflang,
    )
