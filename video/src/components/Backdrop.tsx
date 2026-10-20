import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { BEAT_FRAMES, C, DROP_FRAME } from "../theme";

/** Black stage with hairline rails and a slow-drifting purple glow, shared by every scene. */
export const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 900], [0, 120]);
  // from the drop on, the glow flares on every downbeat (once per bar) and decays
  const sinceBar = frame >= DROP_FRAME ? (frame - DROP_FRAME) % (BEAT_FRAMES * 4) : Infinity;
  const flare = Math.exp(-sinceBar / 10);
  const glowAlpha = (0.22 + flare * 0.16).toFixed(3);

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(900px 600px at ${40 + drift / 10}% ${30 + drift / 20}%, rgba(147,51,234,${glowAlpha}), transparent 70%)`,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${C.hairline} 1px, transparent 1px), linear-gradient(90deg, ${C.hairline} 1px, transparent 1px)`,
          backgroundSize: "120px 120px",
          backgroundPosition: `${-drift}px 0`,
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
          opacity: 0.5,
        }}
      />
      {/* vertical rails, like the site's page frame */}
      {[240, 1680].map((x) => (
        <div key={x} style={{ position: "absolute", left: x, top: 0, bottom: 0, width: 1, background: C.hairline }} />
      ))}
    </AbsoluteFill>
  );
};
