import { Video } from "@remotion/media";
import { AbsoluteFill, Loop, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, F } from "../theme";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Cinematic ease-in-out for camera moves. */
export const camEase = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const outExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

/** Maps frame → 0..1 over [a, b] with an easing. */
export const ramp = (frame: number, a: number, b: number, ease: (t: number) => number = (t) => t) =>
  ease(interpolate(frame, [a, b], [0, 1], clamp));

/** HyperFrames-rendered light plate (haze, particles, beams), screened over everything. */
export const Atmosphere: React.FC = () => (
  <AbsoluteFill style={{ mixBlendMode: "screen", pointerEvents: "none" }}>
    <Video src={staticFile("fx/atmos.mp4")} muted style={{ width: "100%", height: "100%" }} />
  </AbsoluteFill>
);

/** HyperFrames-rendered 2 s grain loop on 50% grey, overlaid. */
export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.32 }) => (
  <AbsoluteFill style={{ mixBlendMode: "overlay", opacity, pointerEvents: "none" }}>
    <Loop durationInFrames={60}>
      <Video src={staticFile("fx/grain.mp4")} muted style={{ width: "100%", height: "100%" }} />
    </Loop>
  </AbsoluteFill>
);

/** Vignette + shadow tint: keeps edges black and pushes violet into the low mids. */
export const Grade: React.FC = () => (
  <>
    <AbsoluteFill style={{ background: "radial-gradient(ellipse 75% 70% at 50% 48%, transparent 45%, rgba(0,0,0,0.72) 100%)" }} />
    <AbsoluteFill style={{ background: "#2a0d4a", mixBlendMode: "soft-light", opacity: 0.35 }} />
  </>
);

/** Horizontal motion blur via an SVG filter. Returns the defs node and the CSS filter value. */
export const useHBlur = (id: string, amount: number) => {
  const a = Math.round(amount * 10) / 10;
  return {
    defs:
      a > 0.2 ? (
        <svg width={0} height={0} style={{ position: "absolute" }}>
          <filter id={id} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={`${a} 0`} />
          </filter>
        </svg>
      ) : null,
    filter: a > 0.2 ? `url(#${id})` : undefined,
  };
};

/**
 * A light band sweeping across its children: renders `children` (a white-tinted copy) masked to a moving
 * diagonal stripe. `progress` 0..1 moves the stripe from left to right.
 */
export const LightSweep: React.FC<{ progress: number; width?: number; children: React.ReactNode }> = ({ progress, width = 18, children }) => {
  if (progress <= 0 || progress >= 1) return null;
  const pos = -width + progress * (100 + width * 2);
  const mask = `linear-gradient(105deg, transparent ${pos - width}%, rgba(0,0,0,0.9) ${pos}%, transparent ${pos + width}%)`;
  return (
    <div style={{ position: "absolute", inset: 0, maskImage: mask, WebkitMaskImage: mask, mixBlendMode: "screen", pointerEvents: "none" }}>
      {children}
    </div>
  );
};

/** Restrained RGB-split glitch for a line of text: active only while `amount` > 0. */
export const GlitchText: React.FC<{ text: React.ReactNode; amount: number; style: React.CSSProperties }> = ({ text, amount, style }) => {
  const frame = useCurrentFrame();
  const jitter = amount > 0 ? ((frame * 7919) % 13) - 6 : 0;
  const dx = amount * 10;
  return (
    <div style={{ position: "relative", ...style }}>
      {amount > 0 ? (
        <>
          <div style={{ position: "absolute", inset: 0, color: "#7c3aed", transform: `translateX(${-dx}px)`, opacity: 0.8, mixBlendMode: "screen" }}>{text}</div>
          <div style={{ position: "absolute", inset: 0, color: "#a5f3fc", transform: `translateX(${dx}px)`, opacity: 0.5, mixBlendMode: "screen" }}>{text}</div>
          <div style={{ position: "absolute", inset: 0, clipPath: `inset(${40 + jitter}% 0 ${44 - jitter}% 0)`, transform: `translateX(${jitter * amount * 4}px)` }}>{text}</div>
        </>
      ) : null}
      <div style={{ opacity: amount > 0 ? 0.9 : 1 }}>{text}</div>
    </div>
  );
};

/** A word that rises out of a mask with a little motion blur. */
export const MaskWord: React.FC<{ word: string; start: number; color?: string; style?: React.CSSProperties }> = ({ word, start, color = C.text, style }) => {
  const frame = useCurrentFrame();
  const p = ramp(frame, start, start + 14, outExpo);
  const blur = (1 - p) * 8;
  return (
    <span style={{ display: "inline-block", overflow: "hidden", verticalAlign: "bottom", paddingBottom: "0.08em", ...style }}>
      <span style={{ display: "inline-block", transform: `translateY(${(1 - p) * 105}%)`, filter: blur > 0.3 ? `blur(${blur}px)` : undefined, color }}>{word}</span>
    </span>
  );
};

export const displayType: React.CSSProperties = {
  fontFamily: F.display,
  fontWeight: 800,
  letterSpacing: "-0.045em",
  lineHeight: 0.98,
  color: C.text,
};

export const eyebrow: React.CSSProperties = {
  fontFamily: F.mono,
  fontSize: 22,
  letterSpacing: "0.32em",
  color: C.muted,
  textTransform: "uppercase",
};
