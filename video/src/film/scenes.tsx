import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Logo } from "../components/Logo";
import { C, F, SITE, SITE_URL } from "../theme";
import { DASH_H, DASH_W, Dashboard, FilterChips, ISSUES, IssueRow, NavList, RING_CENTER, ScoreBars, ScoreRing } from "./Dashboard";
import { GlitchText, LightSweep, MaskWord, camEase, clamp, displayType, eyebrow, outExpo, ramp, useHBlur } from "./fx";

/** Words revealed one by one out of a mask; spacing only between words so lines stay centred. */
const MaskLine: React.FC<{ words: string[]; start: number; step?: number; color?: string; accentFrom?: number }> = ({
  words,
  start,
  step = 3,
  color,
  accentFrom,
}) => (
  <div style={{ whiteSpace: "nowrap" }}>
    {words.map((w, i) => (
      <MaskWord
        key={i}
        word={w}
        start={start + i * step}
        color={accentFrom !== undefined && i >= accentFrom ? C.accent : color}
        style={{ marginRight: i < words.length - 1 ? "0.24em" : 0 }}
      />
    ))}
  </div>
);

/** The logo lockup with dimensional light: back glow, light sweep and an optional floor reflection. */
const LogoLockup: React.FC<{ size: number; sweep: number; glow: number; reflect?: boolean }> = ({ size, sweep, glow, reflect = true }) => (
  <div style={{ position: "relative" }}>
    <div
      style={{
        position: "absolute",
        left: -size * 0.6,
        top: -size * 0.9,
        width: size * 2.4,
        height: size * 2.8,
        borderRadius: "50%",
        background: "radial-gradient(closest-side, rgba(147,51,234,0.55), transparent)",
        filter: "blur(30px)",
        opacity: glow,
      }}
    />
    <div style={{ position: "relative", filter: `drop-shadow(0 0 ${24 * glow}px rgba(191,90,242,${0.55 * glow}))` }}>
      <Logo size={size} />
      <LightSweep progress={sweep}>
        <Logo size={size} tint="#ffffff" />
      </LightSweep>
    </div>
    {reflect ? (
      <div
        style={{
          position: "absolute",
          left: 0,
          top: size * 1.08,
          transform: "scaleY(-1)",
          transformOrigin: "top",
          opacity: 0.18,
          filter: "blur(2px)",
          maskImage: "linear-gradient(to top, black, transparent 70%)",
          WebkitMaskImage: "linear-gradient(to top, black, transparent 70%)",
        }}
      >
        <Logo size={size} />
      </div>
    ) : null}
  </div>
);

// ─── 0–124 · Opening: darkness, the beam (atmosphere plate), then the hook ───────────────────────
export const Opening: React.FC = () => {
  const f = useCurrentFrame();
  const exit = ramp(f, 108, 124, (t) => t * t);
  const scale = interpolate(f, [0, 124], [1, 1.07]) * (1 + exit * 0.4);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          ...displayType,
          fontSize: 118,
          textAlign: "center",
          transform: `scale(${scale}) translateY(${interpolate(f, [0, 124], [12, -12])}px)`,
          filter: exit > 0.02 ? `blur(${exit * 16}px)` : undefined,
          opacity: 1 - exit,
        }}
      >
        <MaskLine words={["Google", "isn't", "the", "only", "one"]} start={30} />
        <MaskLine words={["reading", "your", "site", "anymore."]} start={64} color={C.accent} />
      </div>
    </AbsoluteFill>
  );
};

// ─── 124–240 · Build: the question, then SEO / AEO / GEO on the beat, then blackout before the drop ──
const Slam: React.FC<{ start: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ start, children, style }) => {
  const f = useCurrentFrame();
  const p = ramp(f, start, start + 10, outExpo);
  return <div style={{ opacity: p, transform: `scale(${1.35 - p * 0.35})`, filter: p < 0.98 ? `blur(${(1 - p) * 12}px)` : undefined, ...style }}>{children}</div>;
};

const BIG = [
  { word: "SEO", sub: "Search engines", at: 44, dir: -1 },
  { word: "AEO", sub: "Answer engines", at: 58, dir: 1 },
  { word: "GEO", sub: "AI assistants", at: 73, dir: -1 },
];

export const Build: React.FC = () => {
  const f = useCurrentFrame();
  const qOut = ramp(f, 40, 44);
  const current = [...BIG].reverse().find((b) => f >= b.at);
  const e = ramp(current ? f - current.at : 0, 0, 6, outExpo);
  const blur = useHBlur("build-blur", (1 - e) * 30);
  const exit = ramp(f, 94, 102, (t) => t * t);
  const glitch = current?.word === "GEO" ? interpolate(f, [86, 87, 91], [0, 1, 0], clamp) : 0;
  if (f >= 102) return null; // blackout: the music's pre-drop silence
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      {f < 44 ? (
        <div style={{ ...displayType, fontSize: 104, textAlign: "center", opacity: 1 - qOut }}>
          <Slam start={0}>Who's deciding</Slam>
          <Slam start={22} style={{ color: C.accent }}>
            who gets recommended?
          </Slam>
        </div>
      ) : current ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            transform: `translateX(${(1 - e) * 80 * current.dir}px) scale(${(1.25 - e * 0.25) * (1 + exit * 0.6)})`,
            opacity: 1 - exit,
            filter: blur.filter,
          }}
        >
          {blur.defs}
          <GlitchText text={current.word} amount={glitch} style={{ ...displayType, fontSize: 330, letterSpacing: "-0.05em" }} />
          <div style={{ ...eyebrow, marginTop: 28, color: C.accent }}>{current.sub}</div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// ─── 240–356 · Brand reveal on the drop ─────────────────────────────────────────────────────────────
export const Reveal: React.FC = () => {
  const f = useCurrentFrame();
  const pop = ramp(f, 0, 16, outExpo);
  const push = interpolate(f, [0, 100], [1, 1.07], clamp);
  const exit = ramp(f, 100, 116, (t) => t * t * t);
  const flash = interpolate(f, [0, 2, 9], [0.3, 0.18, 0], clamp);
  const tag = ramp(f, 34, 52, outExpo);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          opacity: Math.min(pop * 1.4, 1) * (1 - exit),
          transform: `scale(${(0.86 + pop * 0.14) * push * (1 + exit * 1.6)})`,
          filter: exit > 0.02 ? `blur(${exit * 18}px)` : undefined,
        }}
      >
        <LogoLockup size={150} sweep={ramp(f, 4, 36)} glow={interpolate(f, [0, 6, 60], [0.4, 1, 0.65], clamp)} />
        <div style={{ ...eyebrow, fontSize: 26, marginTop: 70, opacity: tag, letterSpacing: `${0.6 - tag * 0.28}em` }}>SEO · AEO · GEO AUDIT</div>
      </div>
      <AbsoluteFill style={{ background: "#f3e8ff", opacity: flash }} />
    </AbsoluteFill>
  );
};

// ─── 356–530 · Product showcase: macro on the score ring → pull back to the floating dashboard ─────
export const Showcase: React.FC = () => {
  const f = useCurrentFrame();
  const p = ramp(f, 40, 104, camEase);
  const settle = ramp(f, 104, 170);
  const scale = interpolate(f, [0, 40], [3.35, 3.1], clamp) * (1 - p) + 0.98 * p;
  const fx = interpolate(p, [0, 1], [RING_CENTER.x, DASH_W / 2]);
  const fy = interpolate(p, [0, 1], [RING_CENTER.y, DASH_H / 2]);
  const sy = interpolate(p, [0, 1], [540, 610]);
  const rx = p * 14 - settle * 4;
  const ry = -p * 16 + settle * 7;
  const lift = ramp(f, 100, 130, outExpo);
  const whip = ramp(f, 162, 174, (t) => t * t);
  const blur = useHBlur("show-whip", whip * 60);
  const sheen = ramp(f, 118, 160, camEase);
  return (
    <AbsoluteFill style={{ filter: blur.filter }}>
      {blur.defs}
      <div style={{ position: "absolute", inset: 0, perspective: 2000, transform: `translateX(${-whip * 2200}px)` }}>
        {/* floor light under the card */}
        <div
          style={{
            position: "absolute",
            left: 960 - 700,
            top: sy + 170,
            width: 1400,
            height: 260,
            borderRadius: "50%",
            background: "radial-gradient(closest-side, rgba(147,51,234,0.38), transparent)",
            filter: "blur(40px)",
            opacity: p,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 960 - fx,
            top: sy - fy,
            width: DASH_W,
            height: DASH_H,
            transformOrigin: `${fx}px ${fy}px`,
            transform: `scale(${scale}) rotateX(${rx}deg) rotateY(${ry}deg)`,
            transformStyle: "preserve-3d",
          }}
        >
          <Dashboard t={f} ringStart={6} rowsStart={58} barsStart={52} lift={lift} />
          {/* glossy reflection sweeping across the glass */}
          {sheen > 0 && sheen < 1 ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 12,
                transform: "translateZ(100px)",
                background: `linear-gradient(115deg, transparent ${sheen * 140 - 30}%, rgba(233,213,255,0.10) ${sheen * 140 - 15}%, transparent ${sheen * 140}%)`,
                pointerEvents: "none",
              }}
            />
          ) : null}
        </div>
      </div>
      <div style={{ position: "absolute", top: 96, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", ...displayType, fontSize: 76, transform: `translateX(${-whip * 2200}px)` }}>
        {f >= 108 ? <MaskLine words={["Paste", "a", "URL."]} start={110} /> : null}
        {f >= 120 ? <MaskLine words={["Get", "the", "full", "picture."]} start={122} color={C.accent} /> : null}
      </div>
    </AbsoluteFill>
  );
};

// ─── 530–704 · Feature montage: four reveals, three beats each, whip-panned ─────────────────────────
const SEG = [0, 44, 87, 131, 174];

const Glass: React.FC<{ width: number; children: React.ReactNode }> = ({ width, children }) => (
  <div
    style={{
      position: "relative",
      width,
      borderRadius: 18,
      background: SITE.surface,
      border: "1px solid rgba(255,255,255,0.08)",
      boxShadow: "0 50px 140px rgba(0,0,0,0.7), 0 -1px 0 rgba(191,90,242,0.6), 0 0 110px rgba(147,51,234,0.25)",
      padding: 26,
    }}
  >
    <div style={{ position: "absolute", left: "10%", right: "10%", top: -1, height: 1, background: "linear-gradient(90deg, transparent, #e9d5ff, transparent)" }} />
    {children}
  </div>
);

const FEATURES: { title: string; body: string; ui: (g: number) => React.ReactNode }[] = [
  {
    title: "35+ checks",
    body: "SEO, answer-engine and AI-visibility, in one pass",
    ui: (g) => (
      <Glass width={420}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: F.sans, fontSize: 21, fontWeight: 500, color: SITE.ink, marginBottom: 18 }}>
          <span style={{ width: 32, height: 32, display: "grid", placeItems: "center", borderRadius: 6, background: SITE.ink, color: "#09090b", fontSize: 16, fontWeight: 700 }}>N</span>
          northwind-coffee.com
        </div>
        <NavList t={g} start={6} scale={1.6} />
      </Glass>
    ),
  },
  {
    title: "Core Web Vitals",
    body: "Lighthouse mobile score, LCP, CLS and TBT",
    ui: (g) => (
      <Glass width={640}>
        <ScoreBars t={g} start={6} scale={1.7} focus="Speed" />
        <ul style={{ margin: "26px -26px -26px", padding: 0, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <IssueRow issue={ISSUES[4]} reveal={ramp(g, 14, 26, outExpo)} scale={1.4} />
        </ul>
      </Glass>
    ),
  },
  {
    title: "Live AI mentions",
    body: "Ask real models buyer questions, see if you're named",
    ui: (g) => (
      <Glass width={700}>
        <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
          <ScoreRing score={41} progress={ramp(g, 4, 30, outExpo)} size={150} stroke={10} />
          <div style={{ fontFamily: F.sans }}>
            <div style={{ fontSize: 16, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: SITE.ink3 }}>GEO</div>
            <div style={{ fontSize: 26, color: SITE.ink2, marginTop: 6 }}>AI assistants</div>
          </div>
        </div>
        <ul style={{ margin: "24px -26px -26px", padding: 0, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <IssueRow issue={ISSUES[0]} reveal={ramp(g, 10, 22, outExpo)} scale={1.3} />
          <IssueRow issue={ISSUES[2]} reveal={ramp(g, 14, 26, outExpo)} scale={1.3} />
        </ul>
      </Glass>
    ),
  },
  {
    title: "Ranked fix list",
    body: "Exactly what to fix first, by impact",
    ui: (g) => (
      <Glass width={740}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "-6px 0 14px" }}>
          <p style={{ margin: 0, fontFamily: F.sans, fontSize: 20, fontWeight: 500, color: SITE.ink }}>Fix these first</p>
          <FilterChips scale={1.4} />
        </div>
        <ul style={{ margin: "0 -26px -26px", padding: 0, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          {ISSUES.slice(0, 4).map((issue, k) => (
            <IssueRow key={issue.id} issue={issue} reveal={ramp(g, 6 + k * 3, 18 + k * 3, outExpo)} scale={1.3} />
          ))}
        </ul>
      </Glass>
    ),
  },
];

const FeatureShot: React.FC<{ i: number; g: number; dur: number; last: boolean }> = ({ i, g, dur, last }) => {
  const feat = FEATURES[i];
  const e = ramp(g, 0, 8, outExpo);
  const out = last ? 0 : ramp(g, dur - 6, dur, (t) => t * t);
  const dir = i % 2 === 0 ? 1 : -1;
  const x = (1 - e) * 1000 * dir - out * 1200 * dir;
  const blur = useHBlur(`feat-${i}`, (1 - e) * 50 + out * 60);
  const push = interpolate(g, [0, dur], [1, 1.06]);
  const glitch = i === 2 ? interpolate(g, [0, 1, 5], [0, 1, 0], clamp) : 0;
  return (
    <AbsoluteFill style={{ transform: `translateX(${x}px)`, filter: blur.filter }}>
      {blur.defs}
      <div style={{ position: "absolute", left: 170, top: 0, bottom: 0, width: 760, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ ...eyebrow, color: C.accent }}>{`0${i + 1} / 04`}</div>
        <GlitchText text={feat.title} amount={glitch} style={{ ...displayType, fontSize: 112, marginTop: 26, whiteSpace: "nowrap" }} />
        <div style={{ fontFamily: F.sans, fontSize: 34, lineHeight: 1.35, color: C.muted, marginTop: 26, maxWidth: 640, opacity: ramp(g, 6, 16) }}>{feat.body}</div>
      </div>
      <div style={{ position: "absolute", left: 960, right: 80, top: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", perspective: 1600 }}>
        <div style={{ transform: `rotateY(${-16 + g * 0.08}deg) rotateX(6deg) scale(${push})`, transformStyle: "preserve-3d" }}>{feat.ui(g)}</div>
      </div>
    </AbsoluteFill>
  );
};

export const Features: React.FC = () => {
  const f = useCurrentFrame();
  const i = SEG.findIndex((s, k) => f >= s && f < SEG[k + 1]);
  if (i < 0) return null;
  return <FeatureShot i={i} g={f - SEG[i]} dur={SEG[i + 1] - SEG[i]} last={i === 3} />;
};

// ─── 704–900 · Finale: darkness, then the brand, tagline and call to action ─────────────────────────
export const Finale: React.FC = () => {
  const f = useCurrentFrame();
  const a = ramp(f, 16, 72, camEase);
  const tag = ramp(f, 62, 80, outExpo);
  const pill = ramp(f, 112, 128, outExpo);
  const fadeOut = 1 - ramp(f, 182, 196);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: fadeOut }}>
      <div
        style={{
          opacity: a,
          filter: a < 0.98 ? `blur(${(1 - a) * 18}px)` : undefined,
          transform: `scale(${interpolate(f, [16, 180], [1.05, 1], clamp)})`,
        }}
      >
        <LogoLockup size={120} sweep={ramp(f, 40, 82)} glow={a * 0.8} reflect={false} />
      </div>
      <div style={{ ...eyebrow, fontSize: 24, marginTop: 34, opacity: tag, letterSpacing: `${0.5 - tag * 0.18}em` }}>SEO · AEO · GEO AUDIT</div>
      <div style={{ ...displayType, fontSize: 96, marginTop: 60, minHeight: 100 }}>
        {f >= 90 ? <MaskLine words={["Audit", "your", "site", "free."]} start={92} accentFrom={3} /> : null}
      </div>
      <div
        style={{
          marginTop: 48,
          padding: "24px 54px",
          borderRadius: 999,
          background: C.accentFill,
          color: "#fff",
          fontFamily: F.mono,
          fontWeight: 500,
          fontSize: 34,
          display: "flex",
          gap: 18,
          alignItems: "center",
          opacity: pill,
          transform: `translateY(${(1 - pill) * 20}px) scale(${0.94 + pill * 0.06})`,
          boxShadow: `0 0 ${60 * pill}px rgba(147,51,234,0.45)`,
        }}
      >
        {SITE_URL}
        <span style={{ fontFamily: F.display }}>→</span>
      </div>
    </AbsoluteFill>
  );
};
