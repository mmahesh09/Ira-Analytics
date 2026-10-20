import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, F } from "../theme";

const URL_TEXT = "https://yourbrand.com";
const TYPE_START = 12;
const TYPE_END = 48;
const CLICK = 56;
const SCAN_END = 112;

const LOG = [
  "→ fetching page + robots.txt",
  "→ 19 SEO checks",
  "→ testing 8 AI crawlers · llms.txt",
  "→ FAQ / HowTo schema · snippet answers",
  "→ Lighthouse mobile · Core Web Vitals",
];

const SCORES = [
  { label: "SEO", value: 92, color: C.good },
  { label: "AEO", value: 78, color: C.accent },
  { label: "GEO", value: 64, color: C.warn },
];

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const ScoreRing: React.FC<{ label: string; value: number; color: string; delay: number }> = ({ label, value, color, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: { damping: 200 }, durationInFrames: 40 });
  const r = 92;
  const circ = 2 * Math.PI * r;
  const shown = Math.round(value * p);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, opacity: Math.min(1, p * 3) }}>
      <div style={{ position: "relative", width: 220, height: 220 }}>
        <svg width={220} height={220} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={110} cy={110} r={r} fill="none" stroke={C.hairline} strokeWidth={14} />
          <circle
            cx={110}
            cy={110}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={14}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - (value / 100) * p)}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: F.display,
            fontWeight: 700,
            fontSize: 76,
            color: C.text,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {shown}
        </div>
      </div>
      <span style={{ fontFamily: F.mono, fontSize: 28, letterSpacing: "0.16em", color: C.muted }}>{label}</span>
    </div>
  );
};

export const Demo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 200 } });
  const typed = URL_TEXT.slice(0, Math.floor(interpolate(frame, [TYPE_START, TYPE_END], [0, URL_TEXT.length], clamp)));
  const caretOn = frame < CLICK && Math.floor(frame / 8) % 2 === 0;
  const press = frame >= CLICK && frame < CLICK + 6 ? 0.94 : 1;
  const progress = interpolate(frame, [CLICK + 4, SCAN_END], [0, 1], clamp);
  const logShown = Math.floor(progress * LOG.length + 0.0001);
  const results = interpolate(frame, [SCAN_END, SCAN_END + 14], [0, 1], clamp);

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          position: "absolute",
          top: 90,
          fontFamily: F.display,
          fontWeight: 700,
          fontSize: 60,
          letterSpacing: "-0.03em",
          color: C.text,
          opacity: enter,
        }}
      >
        Paste a URL. <span style={{ color: C.accent }}>Get the full picture.</span>
      </div>

      <div
        style={{
          width: 1340,
          height: 620,
          marginTop: 110,
          borderRadius: 28,
          background: C.panel,
          border: `1px solid ${C.hairline}`,
          boxShadow: "0 40px 120px rgba(147,51,234,0.18)",
          overflow: "hidden",
          opacity: enter,
          transform: `translateY(${(1 - enter) * 60}px) scale(${0.96 + enter * 0.04})`,
        }}
      >
        {/* window chrome */}
        <div style={{ height: 56, display: "flex", alignItems: "center", gap: 10, padding: "0 24px", borderBottom: `1px solid ${C.hairline}` }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ width: 14, height: 14, borderRadius: 99, background: "#3f3f46" }} />
          ))}
          <span style={{ marginLeft: 18, fontFamily: F.mono, fontSize: 20, color: C.dim }}>rankwise · audit console</span>
        </div>

        <div style={{ padding: "40px 56px" }}>
          {/* URL input + button */}
          <div style={{ display: "flex", gap: 18 }}>
            <div
              style={{
                flex: 1,
                height: 84,
                borderRadius: 999,
                background: C.bg,
                border: `1px solid ${frame < CLICK ? "rgba(191,90,242,0.5)" : C.hairline}`,
                display: "flex",
                alignItems: "center",
                padding: "0 36px",
                fontFamily: F.mono,
                fontSize: 32,
                fontVariantLigatures: "none",
                color: C.text,
              }}
            >
              {typed}
              <span style={{ width: 3, height: 38, marginLeft: 4, background: caretOn ? C.accent : "transparent" }} />
            </div>
            <div
              style={{
                height: 84,
                padding: "0 48px",
                borderRadius: 999,
                background: C.accentFill,
                color: "#fff",
                display: "flex",
                alignItems: "center",
                fontFamily: F.display,
                fontWeight: 600,
                fontSize: 32,
                transform: `scale(${press})`,
              }}
            >
              Run audit
            </div>
          </div>

          {/* scanning state, cross-fades into the results */}
          {results < 1 ? (
            <div style={{ marginTop: 36, opacity: 1 - results }}>
              <div style={{ height: 8, borderRadius: 99, background: C.hairline, overflow: "hidden" }}>
                <div style={{ width: `${progress * 100}%`, height: "100%", background: `linear-gradient(90deg, ${C.accentFill}, ${C.accent})` }} />
              </div>
              <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 14 }}>
                {LOG.slice(0, logShown).map((line, i) => (
                  <div key={line} style={{ fontFamily: F.mono, fontSize: 26, color: i === logShown - 1 ? C.text : C.dim }}>
                    {line}
                    {i < logShown - 1 || progress >= 1 ? <span style={{ color: C.good }}>{"  ✓"}</span> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 56, display: "flex", justifyContent: "space-around" }}>
              {SCORES.map((s, i) => (
                <ScoreRing key={s.label} {...s} delay={SCAN_END + i * 8} />
              ))}
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
