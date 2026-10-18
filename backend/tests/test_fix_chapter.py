"""Features 9–12: smart prioritization, one-click fix code and AI content rewrites."""

import json
import re

import pytest

from app.common import SiteFiles
from app.fixes import snippet_for
from app.llm import first_json_object
from app.models import Check
from app.page import parse_page
from app.priority import annotate, severity
from app.routers.content import _options, _prompt

HTML = """<html><head><title>Northwind</title></head><body>
<h1>Fresh coffee</h1>
<h2>What is Northwind?</h2><p>A roastery that delivers beans weekly.</p>
<h2>How fresh is it?</h2><p>Roasted within 48 hours of shipping. </script><script>alert(1)</script></p>
<img src="/bag.png"><img src="/cup.png" alt="A cup">
</body></html>"""


@pytest.fixture
def page():
    return parse_page("https://northwind.example/shop/beans?ref=x", HTML)


@pytest.fixture
def site():
    return SiteFiles(origin="https://northwind.example", robots_txt="User-agent: GPTBot\nDisallow: /\n",
                     sitemap_url=None, sitemap_ok=False, sitemap_url_count=0, llms_txt=None)


def chk(cid, status="fail", weight=2):
    return Check(id=cid, title="t", status=status, weight=weight)


# ---- 9. prioritization ----

def test_severity_scale():
    assert severity(chk("x", "fail", 4)) == "critical"
    assert severity(chk("x", "fail", 1)) == "high"
    assert severity(chk("x", "warn", 3)) == "high"
    assert severity(chk("x", "warn", 2)) == "medium"
    assert severity(chk("x", "warn", 1)) == "low"
    assert severity(chk("x", "pass")) is None


def test_annotate_sets_effort_and_confidence_only_on_open_issues():
    open_issue, passing = chk("ai-crawlers"), chk("ai-crawlers", "pass")
    annotate(open_issue)
    annotate(passing)
    assert (open_issue.effort, open_issue.confidence) == (1, 0.85)
    assert passing.effort is None and passing.severity is None
    heuristic = chk("content-length", "warn")
    annotate(heuristic)
    assert heuristic.effort == 3 and heuristic.confidence < 0.85
    unknown = chk("some-new-check")
    annotate(unknown)
    assert (unknown.effort, unknown.confidence) == (2, 0.85)


# ---- 11. one-click fix code ----

def _jsonld_body(code: str) -> dict:
    return json.loads(re.search(r"<script[^>]*>(.*)</script>", code, re.S).group(1))


def test_faq_jsonld_is_valid_and_script_safe(page, site):
    snip = snippet_for(chk("answer-schema"), page, site)
    data = _jsonld_body(snip.code)
    assert data["@type"] == "FAQPage"
    assert [q["name"] for q in data["mainEntity"]] == ["What is Northwind?", "How fresh is it?"]
    # page text can never close the script tag early
    assert snip.code.count("</script>") == 1


def test_robots_snippet_allows_only_blocked_bots(page, site):
    snip = snippet_for(chk("ai-crawlers", "warn"), page, site)
    assert snip.file == "robots.txt"
    assert "User-agent: GPTBot\nAllow: /" in snip.code
    assert "ClaudeBot" not in snip.code


def test_page_derived_snippets(page, site):
    assert snippet_for(chk("canonical"), page, site).code == '<link rel="canonical" href="https://northwind.example/shop/beans">'
    alt = snippet_for(chk("img-alt"), page, site).code
    assert "/bag.png" in alt and "/cup.png" not in alt
    crumbs = _jsonld_body(snippet_for(chk("breadcrumbs"), page, site).code)
    assert [i["name"] for i in crumbs["itemListElement"]] == ["Home", "Shop", "Beans"]
    assert snippet_for(chk("llms-txt", "warn"), page, site).file == "llms.txt"


def test_no_snippet_for_passing_or_unknown_checks(page, site):
    assert snippet_for(chk("canonical", "pass"), page, site) is None
    assert snippet_for(chk("response-time"), page, site) is None


def test_title_snippet_escapes_html(site):
    p = parse_page("https://x.example/", '<html><head><title>Tom &amp; Jerry <b></title></head><body></body></html>')
    code = snippet_for(chk("title", "warn"), p, site).code
    assert "<b>" not in code.removeprefix("<title>").removesuffix("</title>")


# ---- 12. AI content rewrites ----

def test_first_json_object_handles_fences():
    assert first_json_object('```json\n{"options": []}\n```') == {"options": []}
    with pytest.raises(ValueError):
        first_json_object("no json here")


def test_options_validate_dedupe_and_rank_in_range_first():
    raw = {"options": [
        {"text": "x" * 90, "reason": "too long"},
        {"text": "Fresh coffee beans, roasted to order", "reason": "clear"},
        {"text": "fresh coffee beans, roasted to order"},  # duplicate (case-insensitive)
        {"text": 42},  # wrong type
        "junk",
    ]}
    opts = _options(raw, "title")
    assert [o.in_range for o in opts] == [True, False]
    assert opts[0].length == len("Fresh coffee beans, roasted to order")
    assert opts[1].reason == "too long"


def test_prompt_fences_page_content_as_data(page):
    prompt = _prompt(page, "description", "", None)
    assert prompt.index("<page>") < prompt.index("Content excerpt") < prompt.index("</page>")
    assert "70–160 characters" in prompt
