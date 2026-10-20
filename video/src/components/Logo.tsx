import { C, F } from "../theme";

/** The Rankwise mark, copied from frontend/src/components/site-header.tsx (purple tile, white R). */
export const LogoMark: React.FC<{ size: number; tint?: string }> = ({ size, tint }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
    <rect width="24" height="24" rx="6" fill={tint ?? C.accentFill} />
    <path
      d="M6 17V7h5.2a3.3 3.3 0 0 1 .7 6.5L15 17h-2.6l-2.8-3.3H8.2V17H6Zm2.2-5.2h2.9a1.4 1.4 0 0 0 0-2.8H8.2v2.8Z"
      fill={tint ? "rgba(0,0,0,0.25)" : "#ffffff"}
    />
  </svg>
);

/** Mark + "Rank<wise>" wordmark, as in the site header. `tint` paints the whole lockup one colour (used for light sweeps). */
export const Logo: React.FC<{ size?: number; tint?: string }> = ({ size = 64, tint }) => (
  <div style={{ display: "flex", alignItems: "center", gap: size * 0.32 }}>
    <LogoMark size={size} tint={tint} />
    <span style={{ fontFamily: F.display, fontWeight: 700, fontSize: size * 0.8, letterSpacing: "-0.03em", color: tint ?? C.text, lineHeight: 1 }}>
      Rank<span style={{ color: tint ?? C.accent }}>wise</span>
    </span>
  </div>
);
