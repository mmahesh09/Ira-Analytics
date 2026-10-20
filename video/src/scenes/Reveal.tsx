import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Logo } from "../components/Logo";
import { C, F } from "../theme";

export const Reveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // local frame 15 = end of the incoming transition = the music drop
  const pop = spring({ frame: frame - 15, fps, config: { damping: 14, stiffness: 120 } });
  const tag = spring({ frame: frame - 34, fps, config: { damping: 200 } });
  const ring = interpolate(frame, [15, 55], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          position: "absolute",
          width: 900,
          height: 900,
          borderRadius: "50%",
          border: `2px solid ${C.accent}`,
          opacity: ring > 0 ? (1 - ring) * 0.6 : 0,
          transform: `scale(${0.3 + ring * 0.9})`,
        }}
      />
      <div style={{ transform: `scale(${0.6 + pop * 0.4})`, opacity: pop }}>
        <Logo size={150} />
      </div>
      <div
        style={{
          marginTop: 48,
          fontFamily: F.mono,
          fontSize: 32,
          letterSpacing: "0.22em",
          color: C.muted,
          opacity: tag,
          transform: `translateY(${(1 - tag) * 20}px)`,
        }}
      >
        SEO · AEO · GEO AUDIT
      </div>
    </AbsoluteFill>
  );
};
