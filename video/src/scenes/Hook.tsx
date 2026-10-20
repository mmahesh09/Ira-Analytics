import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, F } from "../theme";

const LINE_1 = "Google isn't the only one".split(" ");
const LINE_2 = ["reading", "your", "site", "anymore."];

const CHIPS = [
  { label: "ChatGPT", x: 300, y: 210, delay: 40 },
  { label: "Perplexity", x: 1430, y: 260, delay: 50 },
  { label: "Gemini", x: 1380, y: 780, delay: 60 },
  { label: "Claude", x: 360, y: 800, delay: 70 },
];

const Word: React.FC<{ word: string; index: number; accent?: boolean }> = ({ word, index, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - 6 - index * 4, fps, config: { damping: 200 } });
  return (
    <span
      style={{
        display: "inline-block",
        marginRight: "0.25em",
        opacity: p,
        transform: `translateY(${(1 - p) * 40}px)`,
        filter: `blur(${(1 - p) * 10}px)`,
        color: accent ? C.accent : C.text,
      }}
    >
      {word}
    </span>
  );
};

export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      {CHIPS.map((c, i) => {
        const p = spring({ frame: frame - c.delay, fps, config: { damping: 200 } });
        const float = Math.sin((frame + i * 20) / 22) * 10;
        return (
          <div
            key={c.label}
            style={{
              position: "absolute",
              left: c.x,
              top: c.y + float,
              opacity: p * 0.75,
              transform: `scale(${0.8 + p * 0.2})`,
              fontFamily: F.mono,
              fontSize: 26,
              color: C.muted,
              padding: "12px 24px",
              borderRadius: 999,
              border: `1px solid ${C.hairline}`,
              background: "rgba(23,23,28,0.8)",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span style={{ width: 10, height: 10, borderRadius: 99, background: C.accent }} />
            {c.label}
          </div>
        );
      })}

      <div
        style={{
          fontFamily: F.display,
          fontWeight: 700,
          fontSize: 104,
          lineHeight: 1.08,
          letterSpacing: "-0.035em",
          textAlign: "center",
          maxWidth: 1400,
        }}
      >
        <div>
          {LINE_1.map((w, i) => (
            <Word key={i} word={w} index={i} />
          ))}
        </div>
        <div>
          {LINE_2.map((w, i) => (
            <Word key={i} word={w} index={LINE_1.length + i} accent />
          ))}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 150,
          fontFamily: F.mono,
          fontSize: 24,
          letterSpacing: "0.2em",
          color: C.dim,
          opacity: interpolate(frame, [60, 80], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        AI ASSISTANTS ARE READING TOO
      </div>
    </AbsoluteFill>
  );
};
