/**
 * Every Rankwise feature in one place. The landing page, /features and in-app empty states read this,
 * so a feature is marked "live" in exactly one spot, and marketing never promises what isn't built yet.
 */
import {
  Accessibility,
  Activity,
  BellRing,
  BookOpenCheck,
  Bot,
  ChartLine,
  Compass,
  FileText,
  Gauge,
  GitCompareArrows,
  History,
  ListOrdered,
  MessagesSquare,
  Palette,
  Radar,
  ScanSearch,
  Sparkles,
  Stethoscope,
  Unlink,
  Wand2,
  type LucideIcon,
} from "lucide-react";

export type Chapter = "detect" | "fix" | "monitor" | "understand" | "report";
export type FeatureStatus = "live" | "soon";

export interface Feature {
  slug: string;
  name: string;
  /** one line, outcome first */
  pitch: string;
  chapter: Chapter;
  icon: LucideIcon;
  status: FeatureStatus;
}

export const FEATURES: Feature[] = [
  // Detect
  { slug: "health-score", name: "Website Health Score", pitch: "One transparent score, built from findings you can check.", chapter: "detect", icon: Gauge, status: "live" },
  { slug: "accessibility", name: "Accessibility Checker", pitch: "Common WCAG problems found, with the fix for each.", chapter: "detect", icon: Accessibility, status: "live" },
  { slug: "broken-links", name: "Broken Link Monitor", pitch: "Every internal and external link checked on a schedule.", chapter: "detect", icon: Unlink, status: "live" },
  { slug: "visual-doctor", name: "Visual Website Doctor", pitch: "Problems circled right on a screenshot of your page.", chapter: "detect", icon: Stethoscope, status: "live" },

  // Prioritise & fix
  { slug: "opportunity-finder", name: "Website Opportunity Finder", pitch: "The fixes worth the most points, in order.", chapter: "fix", icon: Compass, status: "live" },
  { slug: "prioritization", name: "Smart Issue Prioritization", pitch: "Ranked by severity, confidence, effort and impact.", chapter: "fix", icon: ListOrdered, status: "live" },
  { slug: "one-click-fixes", name: "One-Click Fix Suggestions", pitch: "Ready-to-paste code and metadata for each issue.", chapter: "fix", icon: Wand2, status: "live" },
  { slug: "ai-content", name: "AI Content Optimization", pitch: "Better titles, descriptions and headings, written for you.", chapter: "fix", icon: Sparkles, status: "live" },

  // Verify & monitor
  { slug: "monitoring", name: "Continuous Website Monitoring", pitch: "Audits on a schedule, so problems find you first.", chapter: "monitor", icon: Activity, status: "live" },
  { slug: "change-detective", name: "Website Change Detective", pitch: "Audits after every deploy, with what changed.", chapter: "monitor", icon: ScanSearch, status: "live" },
  { slug: "regression-alerts", name: "Performance Regression Alerts", pitch: "Told the day your pages get slower.", chapter: "monitor", icon: BellRing, status: "live" },
  { slug: "health-history", name: "Website Health History", pitch: "Every score, new issue and fix on one timeline.", chapter: "monitor", icon: History, status: "live" },
  { slug: "verification", name: "Before-and-After Verification", pitch: "Proof a fix worked, measured, not assumed.", chapter: "monitor", icon: BookOpenCheck, status: "live" },

  // Understand
  { slug: "traffic", name: "Real Traffic Insights", pitch: "Search Console and Analytics, in the same place as your scores.", chapter: "understand", icon: ChartLine, status: "soon" },
  { slug: "competitors", name: "Competitor Gap Explorer", pitch: "Where rivals beat you on signals, speed and content.", chapter: "understand", icon: GitCompareArrows, status: "soon" },
  { slug: "chat", name: "Chat With Your Website", pitch: "Ask about your site and analytics in plain English.", chapter: "understand", icon: MessagesSquare, status: "soon" },
  { slug: "growth", name: "AI Growth Recommendations", pitch: "Next best actions from verified data, every week.", chapter: "understand", icon: Radar, status: "soon" },
  { slug: "autopilot", name: "AI Website Autopilot", pitch: "Detect, fix and verify, as one continuous loop.", chapter: "understand", icon: Bot, status: "soon" },

  // Report
  { slug: "pdf-reports", name: "AI SEO Report Generator", pitch: "Polished, downloadable PDF reports in one click.", chapter: "report", icon: FileText, status: "soon" },
  { slug: "white-label", name: "White-Label Agency Reports", pitch: "Your logo, colours and client details on every page.", chapter: "report", icon: Palette, status: "soon" },
];

export const CHAPTERS: Record<Chapter, { label: string; title: string; body: string }> = {
  detect: { label: "Detect", title: "See every problem. Before anyone else does.", body: "Search, answer engines, AI assistants, accessibility and links, measured in one pass." },
  fix: { label: "Prioritise & fix", title: "Know exactly what to fix first.", body: "Every issue ranked by what it's worth, with the code to fix it." },
  monitor: { label: "Verify & monitor", title: "Fixed stays fixed.", body: "Scheduled audits, deploy checks and alerts the moment something slips." },
  understand: { label: "Understand", title: "Your site, explained in plain English.", body: "Real traffic, competitors and an assistant that answers from your own data." },
  report: { label: "Report", title: "Reports clients actually read.", body: "Beautiful PDFs with your brand on them, generated in seconds." },
};

export const byChapter = (chapter: Chapter) => FEATURES.filter((f) => f.chapter === chapter);
export const liveCount = FEATURES.filter((f) => f.status === "live").length;
