"""Builds the Rankwise architecture and workflow diagrams as Excalidraw files (excalidraw-diagram-generator skill rules:
Excalifont everywhere, the skill's palette, bound labels and bound arrows). Run: python docs/diagrams/build_diagrams.py
Open the .excalidraw files at https://excalidraw.com or with the Excalidraw VS Code extension."""

import json
import random
from pathlib import Path

OUT = Path(__file__).parent
BLUE, GREEN, YELLOW, RED, PURPLE, GREY = "#a5d8ff", "#b2f2bb", "#ffd43b", "#ffc9c9", "#d0bfff", "#e9ecef"
FONT = 5  # Excalifont, required by the skill


class Diagram:
    def __init__(self, name: str):
        self.name, self.elements, self.rng = name, [], random.Random(name)

    def _base(self, kind: str, x, y, w, h, **extra) -> dict:
        el = {
            "id": f"{kind[:3]}{len(self.elements)}{self.rng.randrange(10**6)}", "type": kind, "x": x, "y": y, "width": w, "height": h,
            "angle": 0, "strokeColor": "#1e1e1e", "backgroundColor": "transparent", "fillStyle": "solid", "strokeWidth": 2,
            "strokeStyle": "solid", "roughness": 1, "opacity": 100, "groupIds": [], "frameId": None, "roundness": None,
            "seed": self.rng.randrange(2**31), "version": 1, "versionNonce": self.rng.randrange(2**31), "isDeleted": False,
            "boundElements": [], "updated": 1, "link": None, "locked": False,
        }
        el.update(extra)
        self.elements.append(el)
        return el

    def _text(self, text: str, x, y, size: int, container: dict | None = None, align="center", color="#1e1e1e") -> dict:
        lines = text.split("\n")
        w = max(len(line) for line in lines) * size * 0.55
        h = len(lines) * size * 1.25
        if container:
            x = container["x"] + (container["width"] - w) / 2
            y = container["y"] + (container["height"] - h) / 2
        el = self._base("text", x, y, w, h, text=text, originalText=text, fontSize=size, fontFamily=FONT, textAlign=align,
                        verticalAlign="middle", containerId=container["id"] if container else None, autoResize=True,
                        lineHeight=1.25, strokeColor=color)
        if container:
            container["boundElements"].append({"type": "text", "id": el["id"]})
        return el

    def title(self, text: str, x=40, y=20, size=32):
        return self._text(text, x, y, size, align="left")

    def note(self, text: str, x, y, size=16, color="#495057"):
        return self._text(text, x, y, size, align="left", color=color)

    def box(self, label: str, x, y, w=220, h=80, color=BLUE, shape="rectangle", size=18, dashed=False):
        el = self._base(shape, x, y, w, h, backgroundColor=color, roundness={"type": 3} if shape == "rectangle" else None,
                        strokeStyle="dashed" if dashed else "solid")
        self._text(label, 0, 0, size, container=el)
        return el

    def zone(self, label: str, x, y, w, h, color=GREY):
        el = self._base("rectangle", x, y, w, h, backgroundColor=color, roundness={"type": 3}, strokeStyle="dashed", opacity=60)
        self._text(label, x + 16, y + 10, 20, align="left", color="#343a40")
        return el

    def line(self, x1, y1, x2, y2, dashed=True, width=1):
        return self._base("line", x1, y1, x2 - x1, y2 - y1, points=[[0, 0], [x2 - x1, y2 - y1]], strokeStyle="dashed" if dashed else "solid",
                          strokeWidth=width, lastCommittedPoint=None, startBinding=None, endBinding=None, startArrowhead=None, endArrowhead=None)

    def arrow(self, a: dict, b: dict, label: str = "", side=("right", "left"), dashed=False, color="#1e1e1e", points=None, size=14):
        def anchor(el, where):
            cx, cy = el["x"] + el["width"] / 2, el["y"] + el["height"] / 2
            return {"right": (el["x"] + el["width"], cy), "left": (el["x"], cy), "top": (cx, el["y"]), "bottom": (cx, el["y"] + el["height"])}[where]

        (x1, y1), (x2, y2) = anchor(a, side[0]), anchor(b, side[1])
        pts = points or [[0, 0], [x2 - x1, y2 - y1]]
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        el = self._base("arrow", x1, y1, max(xs) - min(xs), max(ys) - min(ys), points=pts, strokeColor=color,
                        strokeStyle="dashed" if dashed else "solid", lastCommittedPoint=None, startArrowhead=None, endArrowhead="arrow",
                        startBinding={"elementId": a["id"], "focus": 0, "gap": 4}, endBinding={"elementId": b["id"], "focus": 0, "gap": 4},
                        # routed (multi-point) arrows stay as straight segments; rounding turns them into wide curves
                        roundness=None if len(pts) > 2 else {"type": 2})
        a["boundElements"].append({"type": "arrow", "id": el["id"]})
        b["boundElements"].append({"type": "arrow", "id": el["id"]})
        if label:
            mid = pts[len(pts) // 2] if len(pts) > 2 else [(pts[0][0] + pts[-1][0]) / 2, (pts[0][1] + pts[-1][1]) / 2]
            t = self._text(label, 0, 0, size, color=color)
            t["x"], t["y"] = x1 + mid[0] - t["width"] / 2, y1 + mid[1] - t["height"] / 2
            t["containerId"] = el["id"]
            el["boundElements"].append({"type": "text", "id": t["id"]})
        return el

    def save(self):
        doc = {"type": "excalidraw", "version": 2, "source": "https://excalidraw.com", "elements": self.elements,
               "appState": {"viewBackgroundColor": "#ffffff", "gridSize": 20}, "files": {}}
        (OUT / f"{self.name}.excalidraw").write_text(json.dumps(doc, indent=1), encoding="utf-8")
        shapes = sum(e["type"] in ("rectangle", "ellipse", "diamond") for e in self.elements)
        arrows = sum(e["type"] == "arrow" for e in self.elements)
        print(f"{self.name}.excalidraw: {shapes} shapes, {arrows} arrows, {len(self.elements)} elements")


def system_architecture():
    d = Diagram("1-system-architecture")
    d.title("Rankwise: system architecture")
    user = d.box("User's browser", 40, 330, 200, 90, YELLOW)
    d.zone("Vercel  (rankwise-xi.vercel.app)", 300, 90, 330, 520)
    pages = d.box("Next.js 16 pages\nmarketing · app · legal", 330, 140, 270, 90)
    auth = d.box("Better Auth\n/api/auth/*", 330, 290, 270, 80, PURPLE)
    proxy = d.box("API proxy\n/api/* rewrite", 330, 450, 270, 80)
    d.zone("Render  (ira-analytics.onrender.com)", 700, 90, 380, 520)
    api = d.box("FastAPI API\nsites · audits · billing\nmonitoring · preview", 730, 140, 320, 110, GREEN)
    worker = d.box("Embedded worker\njob queue · scheduler", 730, 300, 320, 80, GREEN)
    engine = d.box("Audit engine\nSEO · AEO · GEO · Speed\nA11y · link crawler", 730, 440, 320, 110, GREEN)
    db = d.box("Neon Postgres\n23 tables", 1160, 300, 220, 90, YELLOW, shape="ellipse")
    razor = d.box("Razorpay\nsubscriptions · orders", 1160, 140, 220, 80, RED)
    psi = d.box("Google PageSpeed", 1160, 450, 220, 60, GREY)
    llm = d.box("OpenRouter ·\nDataForSEO\n(optional)", 1160, 530, 220, 90, GREY, dashed=True, size=16)
    d.arrow(user, pages, "HTTPS pages", ("right", "left"))
    d.arrow(user, auth, "sign-in cookie", ("right", "left"))
    d.arrow(user, proxy, "app API calls", ("right", "left"))
    d.arrow(proxy, api, "/api/* + cookie", ("right", "left"))
    # around the Render zone, through the gap between it and the external services
    d.arrow(auth, db, "users · sessions", ("right", "left"), dashed=True, color="#5f3dc4",
            points=[[0, 0], [50, 0], [50, 310], [530, 310], [530, 15], [560, 15]])
    d.arrow(api, db, "", ("right", "left"))
    d.arrow(worker, db, "asyncpg", ("right", "left"))
    d.arrow(worker, engine, "runs audits", ("bottom", "top"))
    d.arrow(api, razor, "create · verify", ("right", "left"))
    d.arrow(razor, api, "signed webhooks", ("bottom", "right"), dashed=True, color="#c92a2a",
            points=[[0, 0], [0, 60], [-180, 60], [-180, 15], [-220, 15]])
    d.arrow(engine, psi, "speed", ("right", "left"))
    d.arrow(engine, llm, "", ("right", "left"), dashed=True)
    d.note("Browser streams the free preview straight to the API (CORS); everything else goes through the Vercel proxy.", 40, 680)
    d.save()


def audit_workflow():
    d = Diagram("2-full-audit-workflow")
    d.title("Full audit: credits, queue and refunds")
    click = d.box("User clicks\n'Full audit · 1 credit'", 40, 100, 240, 80, YELLOW, shape="ellipse")
    reserve = d.box("Reserve credit\n(per-user lock,\nidempotency key)", 340, 95, 230, 90)
    enough = d.box("Enough\ncredits?", 630, 85, 170, 110, YELLOW, shape="diamond")
    no = d.box("402: upgrade or\nbuy a credit pack", 860, 100, 230, 80, RED)
    queue = d.box("Queue audit job\n(+ reservation id)", 590, 250, 250, 80)
    claim = d.box("Worker claims job\n(FOR UPDATE\nSKIP LOCKED)", 590, 375, 250, 90, GREEN)
    run = d.box("Run full audit\nSEO·AEO·GEO·Speed·A11y", 590, 510, 250, 80, GREEN)
    ok = d.box("Report\nproduced?", 300, 495, 170, 110, YELLOW, shape="diamond")
    store = d.box("Store report · capture credit\nsettle 'Mark fixed' checks", 40, 660, 300, 80, GREEN)
    crawl = d.box("Queue broken-link crawl\n(plan's page limit)", 40, 790, 300, 80)
    retry = d.box("Retry up to 3×\n(1, 4, 16 min)", 400, 680, 220, 80, RED)
    refund = d.box("Release credit\n(automatic refund)", 780, 680, 220, 80, RED)
    d.arrow(click, reserve)
    d.arrow(reserve, enough)
    d.arrow(enough, no, "no")
    d.arrow(enough, queue, "yes", ("bottom", "top"))
    d.arrow(queue, claim, "", ("bottom", "top"))
    d.arrow(claim, run, "", ("bottom", "top"))
    d.arrow(run, ok, "", ("left", "right"))
    d.arrow(ok, store, "yes", ("bottom", "top"))
    d.arrow(store, crawl, "", ("bottom", "top"))
    d.arrow(ok, retry, "no", ("bottom", "top"))
    d.arrow(retry, refund, "still failing")
    d.note("Same key twice = one charge.  Deep audit = 3 credits, 500 pages.  Light checks never use credits.", 40, 910)
    d.save()


def payment_workflow():
    d = Diagram("3-payment-workflow")
    d.title("Subscription payment (Razorpay)")
    cols = {"User": 120, "Billing page": 420, "FastAPI": 720, "Razorpay": 1020}
    heads = {name: d.box(name, x - 110, 90, 220, 60, color) for (name, x), color in zip(cols.items(), (YELLOW, BLUE, GREEN, RED))}
    for x in cols.values():
        d.line(x, 150, x, 980)
    steps = [
        ("User", "Billing page", "Upgrade to Pro"),
        ("Billing page", "FastAPI", "POST /billing/subscribe"),
        ("FastAPI", "Razorpay", "create subscription (server price)"),
        ("Razorpay", "Billing page", "subscription_id → Checkout opens"),
        ("User", "Razorpay", "pays (card / UPI / netbanking)"),
        ("Razorpay", "Billing page", "payment_id + HMAC signature"),
        ("Billing page", "FastAPI", "POST /billing/verify"),
        ("FastAPI", "Razorpay", "verify signature · fetch subscription"),
        ("FastAPI", "FastAPI", "grant this period's credits (keyed)"),
        ("Razorpay", "FastAPI", "webhook subscription.charged"),
        ("FastAPI", "FastAPI", "dedupe event id · same key = no double grant"),
    ]
    y = 190
    for src, dst, label in steps:
        sx, dx = cols[src], cols[dst]
        if src == dst:
            a = d.box(label, sx - 190, y - 22, 380, 44, GREEN, size=14)
        else:
            a = {"id": None}
            start = d._base("ellipse", sx - 4, y - 4, 8, 8, backgroundColor="#1e1e1e")
            end = d._base("ellipse", dx - 4, y - 4, 8, 8, backgroundColor="#1e1e1e")
            dashed = src == "Razorpay"
            d.arrow(start, end, label, ("right", "left") if dx > sx else ("left", "right"), dashed=dashed,
                    color="#c92a2a" if dashed else "#1e1e1e", size=14)
        y += 70
    d.note("Renewals arrive only by webhook. pending = grace period · halted / cancelled / expired = back to Free.", 40, 1000)
    d.save()


def data_model():
    d = Diagram("4-data-model")
    d.title("Data model (Neon Postgres)")
    user = d.box("user\n(Better Auth)", 520, 90, 220, 70, PURPLE)
    sites = d.box("sites\ndomain · cadence · deploy token", 80, 260, 300, 80)
    audits = d.box("audits\nkind full|deep|check · report", 40, 430, 300, 80)
    issues = d.box("issues · verifications\nlink_checks · alerts", 380, 430, 280, 80)
    jobs = d.box("jobs\naudit|check|verify|links", 80, 600, 260, 70, GREY)
    subs = d.box("subscriptions\nplan · status · period", 520, 260, 240, 80, RED)
    pays = d.box("payments · credit_orders", 820, 260, 240, 70, RED)
    grants = d.box("credit_grants\nmonthly | pack | adjustment", 800, 430, 280, 80, GREEN)
    resv = d.box("credit_reservations\nheld → captured | released", 760, 600, 300, 80, GREEN)
    ledger = d.box("credit_ledger\n(append-only)", 1120, 600, 220, 80, GREEN)
    d.arrow(user, sites, "owns", ("left", "top"))
    d.arrow(sites, audits, "1:N", ("bottom", "top"))
    d.arrow(sites, issues, "1:N", ("bottom", "top"))
    d.arrow(sites, jobs, "1:N", ("left", "left"), points=[[0, 0], [-40, 0], [-40, 330], [0, 330]])
    d.arrow(user, subs, "has", ("bottom", "top"))
    d.arrow(user, pays, "pays", ("right", "top"))
    # right of the payments box, then into the grants box from the side
    d.arrow(user, grants, "credits", ("right", "right"), points=[[0, 0], [380, 0], [380, 345], [340, 345]])
    d.arrow(grants, resv, "reserve", ("bottom", "top"))
    d.arrow(resv, ledger, "logs", ("right", "left"))
    # below the issues box, then up into audits
    d.arrow(resv, audits, "pays for", ("left", "bottom"), dashed=True,
            points=[[0, 0], [-60, 0], [-60, -80], [-570, -80], [-570, -130]])
    d.note("Every table referencing user cascades on delete (self-serve account deletion).", 40, 720)
    d.save()


def scheduler():
    d = Diagram("5-scheduler-monitoring")
    d.title("Worker loop: scheduling and monitoring")
    tick = d.box("Every 60 s:\nsites due?", 40, 120, 220, 90, YELLOW, shape="ellipse")
    cap = d.box("Within today's\nlight-check cap?", 330, 110, 210, 110, YELLOW, shape="diamond")
    check = d.box("Queue light check\n(SEO·AEO·GEO, free)", 610, 125, 250, 80, GREEN)
    skip = d.box("Skip until\ntomorrow (UTC)", 330, 290, 210, 70, RED)
    auto = d.box("Monthly auto full audit?\n(opt-in, 1 credit)", 610, 280, 250, 90)
    alert = d.box("Out of credits →\nalert, keep light checks", 990, 280, 260, 90, RED)
    loop = d.box("Claim next job\n→ run → record_audit", 40, 450, 260, 90, GREEN)
    diff = d.box("Diff issues · regressions\n· verify fixes · alerts", 370, 450, 280, 90, GREEN)
    prune = d.box("Daily: prune old jobs,\nlight checks, events", 720, 450, 260, 90, GREY)
    d.arrow(tick, cap)
    d.arrow(cap, check, "yes")
    d.arrow(cap, skip, "no", ("bottom", "top"))
    d.arrow(check, auto, "", ("bottom", "top"))
    d.arrow(auto, alert, "no credits")
    d.arrow(auto, loop, "queued jobs", ("bottom", "top"), dashed=True)
    d.arrow(loop, diff)
    d.arrow(diff, prune, "", ("right", "left"), dashed=True)
    d.note("Stuck credit holds (> 6 h, no job) are released automatically on each pass.", 40, 590)
    d.save()


if __name__ == "__main__":
    for build in (system_architecture, audit_workflow, payment_workflow, data_model, scheduler):
        build()
