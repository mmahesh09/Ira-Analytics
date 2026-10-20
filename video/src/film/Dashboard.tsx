import { Bot, CircleCheck, CircleDot, CircleX, Gauge, LayoutGrid, MessageSquareQuote, Search, TrendingUp, TriangleAlert } from "lucide-react";
import { interpolate } from "remotion";
import { F, SITE } from "../theme";
import { clamp, outExpo } from "./fx";

// Sample report data, copied verbatim from frontend/src/components/hero-preview.tsx.
export const NAV = [
  { icon: LayoutGrid, label: "Fix first", n: "12", active: true },
  { icon: Search, label: "SEO", n: "88" },
  { icon: MessageSquareQuote, label: "AEO", n: "54" },
  { icon: Bot, label: "GEO", n: "41" },
  { icon: Gauge, label: "Speed", n: "76" },
  { icon: TrendingUp, label: "Traffic", n: "8.4k" },
];

export const ISSUES = [
  { id: "GEO-3", icon: CircleX, tone: SITE.bad, title: "PerplexityBot and GPTBot blocked in robots.txt", tag: "Crawlers", p: 3 },
  { id: "AEO-1", icon: CircleX, tone: SITE.bad, title: "No FAQ or HowTo schema on question content", tag: "Schema", p: 3 },
  { id: "GEO-7", icon: TriangleAlert, tone: SITE.warn, title: "Brand entity missing sameAs links", tag: "Entity", p: 2 },
  { id: "SEO-4", icon: TriangleAlert, tone: SITE.warn, title: "Meta description is 182 characters", tag: "On-page", p: 2 },
  { id: "SPD-2", icon: TriangleAlert, tone: SITE.warn, title: "Total Blocking Time 340 ms on mobile", tag: "Vitals", p: 2 },
  { id: "AEO-5", icon: CircleDot, tone: SITE.ink3, title: "3 answers longer than snippet length", tag: "Content", p: 1 },
  { id: "SEO-1", icon: CircleCheck, tone: SITE.good, title: "Canonical and hreflang are valid", tag: "On-page", p: 0 },
];

export const BARS = [
  { label: "SEO", v: 88, c: SITE.good },
  { label: "AEO", v: 54, c: SITE.warn },
  { label: "GEO", v: 41, c: SITE.bad },
  { label: "Speed", v: 76, c: SITE.warn },
];

const OVERALL = 67;
/** scoreTone() from frontend/src/lib/format.ts */
const tone = (s: number) => (s >= 80 ? SITE.good : s >= 50 ? SITE.warn : SITE.bad);

const line = "rgba(255,255,255,0.06)";

export const Priority: React.FC<{ level: number }> = ({ level }) => (
  <span style={{ display: "flex", alignItems: "flex-end", gap: 2 }}>
    {[1, 2, 3].map((i) => (
      <span key={i} style={{ width: 3, height: 4 + i * 3, borderRadius: 1, background: i <= level ? SITE.ink2 : "rgba(255,255,255,0.15)" }} />
    ))}
  </span>
);

export const ScoreRing: React.FC<{ score: number; progress: number; size: number; stroke: number }> = ({ score, progress, size, stroke }) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const shown = Math.round(score * progress);
  return (
    <div style={{ position: "relative", width: size, height: size, display: "grid", placeItems: "center" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)", position: "absolute", inset: 0 }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} stroke="rgba(255,255,255,0.07)" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke={tone(score)}
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - (score / 100) * progress)}
        />
      </svg>
      <span style={{ position: "relative", fontFamily: F.sans, fontWeight: 500, fontSize: size * 0.3, color: tone(score), fontVariantNumeric: "tabular-nums" }}>{shown}</span>
    </div>
  );
};

export const IssueRow: React.FC<{ issue: (typeof ISSUES)[number]; reveal: number; scale?: number }> = ({ issue, reveal, scale = 1 }) => {
  const Icon = issue.icon;
  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12 * scale,
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        padding: `${10 * scale}px ${16 * scale}px`,
        fontFamily: F.sans,
        fontSize: 13 * scale,
        opacity: reveal,
        transform: `translateY(${(1 - reveal) * 8 * scale}px)`,
        listStyle: "none",
      }}
    >
      <span style={{ transform: `scale(${scale})`, transformOrigin: "left bottom" }}>
        <Priority level={issue.p} />
      </span>
      <span style={{ width: 48 * scale, flexShrink: 0, fontSize: 11 * scale, color: SITE.ink3, marginLeft: (scale - 1) * 10 }}>{issue.id}</span>
      <Icon size={14 * scale} color={issue.tone} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: SITE.ink2 }}>{issue.title}</span>
      <span style={{ flexShrink: 0, borderRadius: 999, border: "1px solid rgba(255,255,255,0.08)", padding: `${2 * scale}px ${8 * scale}px`, fontSize: 11 * scale, color: SITE.ink3 }}>
        {issue.tag}
      </span>
    </li>
  );
};

export const NavList: React.FC<{ t: number; start: number; scale?: number; highlight?: string }> = ({ t, start, scale = 1, highlight }) => (
  <ul style={{ margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 * scale, fontFamily: F.sans, fontSize: 13 * scale }}>
    {NAV.map((n, k) => {
      const r = outExpo(interpolate(t, [start + k * 3, start + k * 3 + 10], [0, 1], clamp));
      const on = highlight ? n.label === highlight : n.active;
      return (
        <li
          key={n.label}
          style={{
            listStyle: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderRadius: 6 * scale,
            padding: `${6 * scale}px ${8 * scale}px`,
            background: on ? "rgba(255,255,255,0.06)" : "transparent",
            color: on ? SITE.ink : SITE.ink3,
            opacity: r,
            transform: `translateX(${(1 - r) * -10 * scale}px)`,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 8 * scale }}>
            <n.icon size={14 * scale} /> {n.label}
          </span>
          <span style={{ fontSize: 11 * scale, color: SITE.ink3 }}>{n.n}</span>
        </li>
      );
    })}
  </ul>
);

export const ScoreBars: React.FC<{ t: number; start: number; scale?: number; focus?: string }> = ({ t, start, scale = 1, focus }) => (
  <ul style={{ margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12 * scale }}>
    {BARS.map((b, k) => {
      const g = outExpo(interpolate(t, [start + k * 3, start + k * 3 + 22], [0, 1], clamp));
      const dim = focus && focus !== b.label ? 0.45 : 1;
      return (
        <li key={b.label} style={{ listStyle: "none", opacity: dim }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: F.sans, fontSize: 12 * scale }}>
            <span style={{ color: SITE.ink3 }}>{b.label}</span>
            <span style={{ color: SITE.ink2, fontVariantNumeric: "tabular-nums" }}>{Math.round(b.v * g)}</span>
          </div>
          <div style={{ marginTop: 6 * scale, height: 4 * scale, borderRadius: 99, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${b.v * g}%`, borderRadius: 99, background: b.c }} />
          </div>
        </li>
      );
    })}
  </ul>
);

export const FilterChips: React.FC<{ scale?: number }> = ({ scale = 1 }) => (
  <div style={{ display: "flex", gap: 6 * scale, fontFamily: F.sans, fontSize: 11 * scale }}>
    <span style={{ borderRadius: 6 * scale, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", padding: `${2 * scale}px ${8 * scale}px`, color: SITE.ink2 }}>All 33</span>
    <span style={{ padding: `${2 * scale}px ${8 * scale}px`, color: SITE.ink3 }}>Critical 4</span>
    <span style={{ padding: `${2 * scale}px ${8 * scale}px`, color: SITE.ink3 }}>Improve 12</span>
  </div>
);

export const DASH_W = 1180;
export const DASH_H = 470;

/**
 * The site's report preview (hero-preview.tsx), driven by frame `t`.
 * `lift` 0..1 separates the three columns in depth (floating panels); needs a preserve-3d parent.
 */
export const Dashboard: React.FC<{ t: number; ringStart: number; rowsStart: number; barsStart: number; lift: number }> = ({ t, ringStart, rowsStart, barsStart, lift }) => {
  const ring = outExpo(interpolate(t, [ringStart, ringStart + 34], [0, 1], clamp));
  const col: React.CSSProperties = { position: "absolute", top: 0, bottom: 0 };
  return (
    <div style={{ position: "relative", width: DASH_W, height: DASH_H, transformStyle: "preserve-3d", fontFamily: F.sans, color: SITE.ink }}>
      {/* backplate: card border, shadow and purple rim light */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 12,
          background: SITE.surface,
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.4), 0 40px 120px rgba(0,0,0,0.6), 0 -1px 0 rgba(191,90,242,0.55), 0 0 90px rgba(147,51,234,0.22)",
        }}
      />
      <div style={{ position: "absolute", left: "8%", right: "8%", top: -1, height: 1, background: "linear-gradient(90deg, transparent, #e9d5ff, transparent)" }} />

      {/* sidebar */}
      <aside
        style={{
          ...col,
          left: 0,
          width: 200,
          borderRight: `1px solid ${line}`,
          background: "rgba(6,6,8,0.6)",
          borderRadius: "12px 0 0 12px",
          padding: 12,
          transform: `translateZ(${lift * 10}px)`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, borderRadius: 6, padding: "6px 8px" }}>
          <span style={{ width: 20, height: 20, display: "grid", placeItems: "center", borderRadius: 4, background: SITE.ink, color: "#09090b", fontSize: 10, fontWeight: 700 }}>N</span>
          <span style={{ fontSize: 13, fontWeight: 500 }}>northwind-coffee.com</span>
        </div>
        <div style={{ marginTop: 16 }}>
          <NavList t={t} start={rowsStart - 6} />
        </div>
      </aside>

      {/* issue list */}
      <main style={{ ...col, left: 200, right: 240, transform: `translateZ(${lift * 34}px)` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${line}`, padding: "12px 16px" }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>Fix these first</p>
          <FilterChips />
        </div>
        <ul style={{ margin: 0, padding: 0 }}>
          {ISSUES.map((issue, k) => (
            <IssueRow key={issue.id} issue={issue} reveal={outExpo(interpolate(t, [rowsStart + k * 4, rowsStart + k * 4 + 12], [0, 1], clamp))} />
          ))}
        </ul>
      </main>

      {/* score panel */}
      <aside
        style={{
          ...col,
          right: 0,
          width: 240,
          borderLeft: `1px solid ${line}`,
          padding: 20,
          borderRadius: "0 12px 12px 0",
          background: `rgba(14,14,17,${0.85 * lift})`,
          boxShadow: lift > 0 ? `0 30px 80px rgba(0,0,0,${0.5 * lift}), 0 0 0 1px rgba(191,90,242,${0.25 * lift})` : undefined,
          transform: `translateZ(${lift * 90}px)`,
        }}
      >
        <p style={{ margin: 0, fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: SITE.ink3 }}>Overall</p>
        <div style={{ marginTop: 12 }}>
          <ScoreRing score={OVERALL} progress={ring} size={104} stroke={7} />
        </div>
        <div style={{ marginTop: 24 }}>
          <ScoreBars t={t} start={barsStart} />
        </div>
      </aside>
    </div>
  );
};

/** Centre of the overall score ring inside the dashboard (for the macro opening shot). */
export const RING_CENTER = { x: DASH_W - 240 + 20 + 52, y: 20 + 16 + 12 + 52 };
