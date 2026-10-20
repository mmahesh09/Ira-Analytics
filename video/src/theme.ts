import { loadFont as loadInterTight } from "@remotion/google-fonts/InterTight";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { loadFont as loadGoogleSans } from "@remotion/google-fonts/GoogleSans";

const display = loadInterTight("normal", { weights: ["400", "500", "600", "700", "800"], subsets: ["latin"] });
const mono = loadMono("normal", { weights: ["400", "500"], subsets: ["latin"] });
const sans = loadGoogleSans("normal", { weights: ["400", "500", "700"], subsets: ["latin"] });

/** Same tokens as the Rankwise site (rudraai.online brand). */
export const C = {
  bg: "#09090b",
  panel: "#111114",
  panelHi: "#17171c",
  hairline: "rgba(255,255,255,0.08)",
  text: "#fafafa",
  muted: "#a1a1aa",
  dim: "#52525b",
  accent: "#bf5af2",
  accentFill: "#9333ea",
  good: "#4ade80",
  warn: "#fbbf24",
} as const;

export const F = {
  display: display.fontFamily,
  mono: mono.fontFamily,
  /** the site's UI face (font-sub / font-mono in frontend/src/app/globals.css) */
  sans: sans.fontFamily,
} as const;

/** Site tokens from frontend/src/app/globals.css, used by the dashboard rebuild. */
export const SITE = {
  surface: "#0e0e11",
  surfaceInk: "#060608",
  ink: "#fafafa",
  ink2: "#d4d4d8",
  ink3: "#a1a1aa",
  good: "#3ccf91",
  warn: "#f59e0b",
  bad: "#ef4444",
} as const;

export const FPS = 30;
/** "Melodia" runs at 124 BPM; its main drop is placed on frame 240 (the logo reveal). */
export const BEAT_FRAMES = (FPS * 60) / 124;
export const DROP_FRAME = 240;
export const SITE_URL = "rankwise-xi.vercel.app";
