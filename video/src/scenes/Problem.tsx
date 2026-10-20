import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, F } from "../theme";

const ROWS = [
  { tag: "SEO", name: "Search engines", checked: true },
  { tag: "AEO", name: "Answer engines", checked: false },
  { tag: "GEO", name: "AI assistants", checked: false },
];

export const Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const title = spring({ frame, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 56 }}>
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
        Who's deciding <span style={{ color: C.accent }}>who gets recommended?</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 22, width: 1100 }}>
        {ROWS.map((r, i) => {
          const p = spring({ frame: frame - 14 - i * 9, fps, config: { damping: 200 } });
          const stamp = spring({ frame: frame - 50 - i * 10, fps, config: { damping: 12, stiffness: 180 } });
          return (
            <div
              key={r.tag}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 32,
                padding: "30px 40px",
                borderRadius: 24,
                background: C.panel,
                border: `1px solid ${r.checked ? C.hairline : "rgba(191,90,242,0.35)"}`,
                opacity: p,
                transform: `translateX(${(1 - p) * -80}px)`,
              }}
            >
              <span style={{ fontFamily: F.mono, fontSize: 30, color: C.accent, width: 90 }}>{r.tag}</span>
              <span style={{ fontFamily: F.display, fontSize: 44, fontWeight: 600, color: C.text, flex: 1 }}>{r.name}</span>
              <span
                style={{
                  fontFamily: F.mono,
                  fontSize: 24,
                  letterSpacing: "0.12em",
                  padding: "10px 20px",
                  borderRadius: 999,
                  color: r.checked ? C.good : C.warn,
                  background: r.checked ? "rgba(74,222,128,0.1)" : "rgba(251,191,36,0.1)",
                  opacity: interpolate(stamp, [0, 1], [0, 1]),
                  transform: `scale(${interpolate(stamp, [0, 1], [1.6, 1])})`,
                }}
              >
                {r.checked ? "✓ CHECKED" : "UNCHECKED"}
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
