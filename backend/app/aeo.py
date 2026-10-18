"""Answer Engine Optimization: can featured snippets, PAA boxes and voice assistants lift answers from this page?"""

from .common import score_checks, summarize
from .models import Check, ModuleResult
from .page import QUESTION_RE, Page

ANSWER_SCHEMAS = {"FAQPage", "HowTo", "QAPage"}


def _answer_lengths(page: Page) -> list[dict]:
    """Word counts of the first paragraph that follows each question-style heading."""
    results = []
    for heading in page.soup.find_all(["h2", "h3", "h4"]):
        text = heading.get_text(" ", strip=True)
        if not (text.endswith("?") or QUESTION_RE.match(text)):
            continue
        answer = heading.find_next(["p", "li", "dd"])
        words = len(answer.get_text(" ", strip=True).split()) if answer else 0
        results.append({"question": text[:140], "answer_words": words})
    return results[:20]


def analyze_aeo(page: Page) -> ModuleResult:
    checks: list[Check] = []

    answer_schema = ANSWER_SCHEMAS & page.schema_types
    checks.append(Check(
        id="answer-schema",
        title=f"{', '.join(sorted(answer_schema))} schema found" if answer_schema else "No FAQ / HowTo / Q&A schema",
        status="pass" if answer_schema else "fail", weight=3,
        fix=None if answer_schema else "Mark up question-and-answer content with FAQPage or HowTo JSON-LD so engines can lift it directly.",
    ))

    questions = page.question_headings
    checks.append(Check(
        id="question-headings", title=f"{len(questions)} question-style headings",
        status="pass" if len(questions) >= 3 else "warn" if questions else "fail", weight=3,
        detail="; ".join(q[:70] for q in questions[:4]),
        fix=None if len(questions) >= 3 else "Phrase subheadings as the questions people actually ask (“How does X work?”).",
    ))

    answers = _answer_lengths(page)
    if answers:
        concise = [a for a in answers if 20 <= a["answer_words"] <= 80]
        ratio = len(concise) / len(answers)
        checks.append(Check(
            id="concise-answers", title=f"{len(concise)} of {len(answers)} questions get a snippet-length answer",
            status="pass" if ratio >= 0.6 else "warn" if concise else "fail", weight=3,
            detail="Snippet-friendly answers are 20–80 words, directly under the question.",
            fix=None if ratio >= 0.6 else "Open each answer with a direct 40–60 word summary before going into detail.",
        ))

    lists = len(page.soup.find_all(["ol", "ul"]))
    tables = len(page.soup.find_all("table"))
    checks.append(Check(
        id="structured-content", title=f"{lists} lists and {tables} tables",
        status="pass" if lists + tables >= 2 else "warn", weight=2,
        fix=None if lists + tables >= 2 else "Use numbered steps, bullet lists and comparison tables — they are the formats engines quote most.",
    ))

    breadcrumb = "BreadcrumbList" in page.schema_types
    checks.append(Check(
        id="breadcrumbs", title="Breadcrumb schema found" if breadcrumb else "No breadcrumb schema",
        status="pass" if breadcrumb else "warn", weight=1,
        fix=None if breadcrumb else "Add BreadcrumbList JSON-LD so results show your site hierarchy.",
    ))

    article = page.schema_types & {"Article", "BlogPosting", "NewsArticle", "Product", "Service", "WebPage"}
    checks.append(Check(
        id="entity-schema", title="Page type is described in schema" if article else "Page type isn't described in schema",
        status="pass" if article else "warn", weight=1, detail=", ".join(sorted(article)),
        fix=None if article else "Declare what the page is (Article, Product, Service…) in JSON-LD.",
    ))

    desc = page.meta.get("description", "")
    summary_ok = 15 <= len(desc.split()) <= 35
    checks.append(Check(
        id="summary", title="Description works as a spoken answer" if summary_ok else "Description isn't answer-shaped",
        status="pass" if summary_ok else "warn", weight=1,
        fix=None if summary_ok else "Write the meta description as a one-sentence answer (15–35 words) a voice assistant could read aloud.",
    ))

    return ModuleResult(
        key="aeo",
        score=score_checks(checks),
        summary=summarize(checks),
        checks=checks,
        data={"questions": answers, "lists": lists, "tables": tables, "schema_types": sorted(page.schema_types)},
    )
