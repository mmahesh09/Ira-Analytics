import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Logo } from "../components/Logo";
import { BEAT_FRAMES, C, F, SITE_URL } from "../theme";

export const Cta: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = spring({ frame, fps, config: { damping: 200 } });
  const head = spring({ frame: frame - 10, fps, config: { damping: 200 } });
  const btn = spring({ frame: frame - 24, fps, config: { damping: 12, stiffness: 140 } });
  const { durationInFrames } = useVideoConfig();
  // the CTA starts 15 frames before a bar line, so (frame - 15) sits on the beat grid
  const phase = (((frame - 15) % BEAT_FRAMES) + BEAT_FRAMES) % BEAT_FRAMES;
  const kick = Math.exp(-phase / 4);
  const pulse = frame > 40 ? 1 + kick * 0.035 : 1;
  const glow = 0.25 + kick * 0.35;
  const fadeOut = interpolate(frame, [durationInFrames - 15, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: fadeOut }}>
      <div style={{ opacity: logo, transform: `translateY(${(1 - logo) * -20}px)` }}>
        <Logo size={72} />
      </div>
      <div
        style={{
          marginTop: 56,
          fontFamily: F.display,
          fontWeight: 800,
          fontSize: 132,
          letterSpacing: "-0.04em",
          color: C.text,
          opacity: head,
          transform: `translateY(${(1 - head) * 30}px)`,
        }}
      >
        Audit your site <span style={{ color: C.accent }}>free.</span>
      </div>
      <div
        style={{
          marginTop: 64,
          padding: "30px 64px",
          borderRadius: 999,
          background: C.accentFill,
          color: "#fff",
          fontFamily: F.mono,
          fontWeight: 500,
          fontSize: 40,
          display: "flex",
          alignItems: "center",
          gap: 22,
          opacity: Math.min(1, btn),
          transform: `scale(${(0.7 + btn * 0.3) * pulse})`,
          boxShadow: `0 0 80px rgba(147,51,234,${glow})`,
        }}
      >
        {SITE_URL}
        <span style={{ fontFamily: F.display }}>→</span>
      </div>
    </AbsoluteFill>
  );
};
