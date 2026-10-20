import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, F } from "../theme";

const Icon: React.FC<{ d: string }> = ({ d }) => (
  <svg width={56} height={56} viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const FEATURES = [
  { title: "35+ checks", body: "SEO, answer-engine and AI-visibility, in one pass", icon: "M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9" },
  { title: "Core Web Vitals", body: "Lighthouse mobile score, LCP, CLS and TBT", icon: "M13 2L3 14h9l-1 8 10-12h-9l1-8z" },
  { title: "Live AI mentions", body: "Ask real models buyer questions, see if you're named", icon: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" },
  { title: "Ranked fix list", body: "Exactly what to fix first, by impact", icon: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" },
];

export const Features: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const title = spring({ frame, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 64 }}>
      <div
        style={{
          fontFamily: F.display,
          fontWeight: 700,
          fontSize: 72,
          letterSpacing: "-0.03em",
          color: C.text,
          opacity: title,
          transform: `translateY(${(1 - title) * 24}px)`,
        }}
      >
        Rank everywhere <span style={{ color: C.accent }}>people search.</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 640px)", gap: 28 }}>
        {FEATURES.map((f, i) => {
          const p = spring({ frame: frame - 12 - i * 10, fps, config: { damping: 18, stiffness: 140 } });
          return (
            <div
              key={f.title}
              style={{
                padding: "40px 44px",
                borderRadius: 28,
                background: C.panel,
                border: `1px solid ${C.hairline}`,
                display: "flex",
                gap: 30,
                alignItems: "flex-start",
                opacity: Math.min(1, p),
                transform: `translateY(${(1 - p) * 60}px) scale(${0.92 + p * 0.08})`,
              }}
            >
              <div style={{ padding: 16, borderRadius: 18, background: "rgba(191,90,242,0.1)" }}>
                <Icon d={f.icon} />
              </div>
              <div>
                <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 44, color: C.text, letterSpacing: "-0.02em" }}>{f.title}</div>
                <div style={{ marginTop: 10, fontFamily: F.display, fontSize: 28, lineHeight: 1.35, color: C.muted }}>{f.body}</div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
