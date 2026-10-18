"use client";

import { useEffect, useRef, useState } from "react";
import { m, useInView, useReducedMotion, useScroll, useSpring } from "framer-motion";
import { Check, CircleCheck, LoaderCircle, Sparkles, X } from "lucide-react";

const EASE = [0.16, 1, 0.3, 1] as const;

/** Window-style frame with a title bar, used for every product illustration. */
function Frame({ children, label, meta }: { children: React.ReactNode; label: string; meta?: string }) {
  return (
    <div aria-hidden="true" className="panel overflow-hidden rounded-xl">
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-2.5">
        <span className="flex items-center gap-2.5">
          <span className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-white/[0.08]" />
            <span className="size-2.5 rounded-full bg-white/[0.08]" />
            <span className="size-2.5 rounded-full bg-white/[0.08]" />
          </span>
          <span className="font-sub text-[12px] text-ink-3">{label}</span>
        </span>
        {meta && <span className="font-mono text-[11px] text-ink-3">{meta}</span>}
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </div>
  );
}

/** Google result preview with annotated checks. */
export function SerpDemo() {
  const checks = ["Title 52 chars", "Meta 148 chars", "Canonical set", "0 broken links"];
  return (
    <Frame label="Search result preview" meta="SEO 88">
      <div className="rounded-lg border border-white/[0.06] bg-surface-ink/60 p-4">
        <p className="font-sub text-[13px] text-ink-3">northwind-coffee.com › guides</p>
        <p className="mt-1 font-sub text-[19px] leading-snug text-[#8ab4f8]">How to brew pour-over coffee at home | Northwind</p>
        <p className="mt-1 text-[14px] leading-relaxed text-ink-2">A step-by-step pour-over guide: grind size, water temperature and timing for a clean, sweet cup every time.</p>
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-2">
        {checks.map((c, i) => (
          <m.li
            key={c}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, ease: EASE, delay: 0.15 + i * 0.08 }}
            className="flex items-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2 font-sub text-[13px] text-ink-2"
          >
            <Check aria-hidden="true" className="size-3.5 text-good" /> {c}
          </m.li>
        ))}
      </ul>
    </Frame>
  );
}

/** Featured snippet card lifted from a question heading. */
export function SnippetDemo() {
  return (
    <Frame label="People also ask" meta="AEO 54">
      <p className="font-display text-[18px] font-medium tracking-[-0.01em]">What grind size is best for pour-over?</p>
      <m.p
        initial={{ backgroundSize: "0% 100%" }}
        whileInView={{ backgroundSize: "100% 100%" }}
        viewport={{ once: true }}
        transition={{ duration: 1.1, ease: EASE, delay: 0.2 }}
        className="mt-3 bg-gradient-to-r from-white/[0.07] to-white/[0.07] bg-no-repeat text-[15px] leading-relaxed text-ink-2"
      >
        A medium-fine grind, similar to table salt, works best. It lets water flow evenly in three to four minutes without over-extracting.
      </m.p>
      <div className="mt-5 flex flex-wrap gap-2 font-sub text-[12px]">
        {["FAQPage schema", "42-word answer", "Question heading"].map((t) => (
          <span key={t} className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-ink-2">
            <CircleCheck className="size-3 text-good" /> {t}
          </span>
        ))}
      </div>
    </Frame>
  );
}

const BOTS = [
  { bot: "GPTBot", owner: "OpenAI", ok: true },
  { bot: "OAI-SearchBot", owner: "ChatGPT search", ok: true },
  { bot: "ClaudeBot", owner: "Anthropic", ok: true },
  { bot: "PerplexityBot", owner: "Perplexity", ok: false },
  { bot: "Google-Extended", owner: "Gemini", ok: true },
  { bot: "Applebot-Extended", owner: "Apple", ok: true },
];

/** AI crawler checklist that resolves one row at a time once visible. */
export function CrawlerDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const reduce = useReducedMotion();
  const [done, setDone] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      const t = setTimeout(() => setDone(BOTS.length), 0);
      return () => clearTimeout(t);
    }
    const timer = setInterval(() => setDone((d) => (d >= BOTS.length ? d : d + 1)), 380);
    return () => clearInterval(timer);
  }, [inView, reduce]);

  return (
    <div ref={ref}>
      <Frame label="robots.txt · AI crawler access" meta="GEO 41">
        <ul className="divide-y divide-white/[0.05]">
          {BOTS.map((b, i) => {
            const resolved = i < done;
            return (
              <li key={b.bot} className="flex items-center justify-between gap-3 py-2.5">
                <span className="font-sub text-[14px]">
                  {b.bot} <span className="ml-1 text-ink-3">{b.owner}</span>
                </span>
                {!resolved ? (
                  <LoaderCircle className="size-4 animate-spin text-ink-3" />
                ) : (
                  <m.span
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.25, ease: EASE }}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-sub text-[12px] font-medium ${b.ok ? "bg-good-soft text-good" : "bg-bad-soft text-bad"}`}
                  >
                    {b.ok ? <Check className="size-3" /> : <X className="size-3" />}
                    {b.ok ? "Allowed" : "Blocked"}
                  </m.span>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-4 flex items-center gap-2 border-t border-white/[0.05] pt-4 font-sub text-[13px] text-ink-2">
          <Sparkles aria-hidden="true" className="size-4 text-ink-3" /> Mentioned in 2 of 6 AI answers for &ldquo;best coffee subscription&rdquo;
        </p>
      </Frame>
    </div>
  );
}

const VITALS = [
  { label: "LCP", value: "1.9 s", pct: 38, tone: "bg-good" },
  { label: "CLS", value: "0.04", pct: 22, tone: "bg-good" },
  { label: "TBT", value: "340 ms", pct: 61, tone: "bg-warn" },
];

export function SpeedDemo() {
  return (
    <ul aria-hidden="true" className="mt-8 space-y-4">
      {VITALS.map((v, i) => (
        <li key={v.label}>
          <div className="flex justify-between font-sub text-[13px]">
            <span className="text-ink-3">{v.label}</span>
            <span className="font-mono text-ink-2">{v.value}</span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
            <m.div
              className={`h-1 origin-left rounded-full ${v.tone}`}
              style={{ width: `${v.pct}%` }}
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, ease: EASE, delay: i * 0.1 }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

const BARS = [22, 30, 26, 38, 44, 41, 52, 58, 55, 66, 72, 80];

export function TrafficDemo() {
  return (
    <div aria-hidden="true" className="relative mt-8">
      <div className="absolute inset-x-0 top-0 flex h-36 flex-col justify-between">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="h-px bg-white/[0.04]" />
        ))}
      </div>
      <div className="relative flex h-36 items-end gap-1.5">
        {BARS.map((h, i) => (
          <m.div
            key={i}
            className={`flex-1 origin-bottom rounded-t-[2px] ${i === BARS.length - 1 ? "bg-ink" : "bg-white/[0.14]"}`}
            style={{ height: `${h}%` }}
            initial={{ scaleY: 0 }}
            whileInView={{ scaleY: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: EASE, delay: i * 0.04 }}
          />
        ))}
      </div>
      <div className="mt-3 flex justify-between font-mono text-[11px] text-ink-3">
        <span>12 months ago</span>
        <span className="text-ink-2">8.4k visits / mo</span>
        <span>Now</span>
      </div>
    </div>
  );
}

/** The copy-paste fix that ships with every failed check. */
export function FixDemo() {
  const lines: [string, string][] = [
    ["tag", '<script type="application/ld+json">'],
    ["dim", "{"],
    ["key", '  "@type": "FAQPage",'],
    ["key", '  "mainEntity": [{'],
    ["key", '    "@type": "Question",'],
    ["str", '    "name": "What grind size is best?",'],
    ["key", '    "acceptedAnswer": { … }'],
    ["dim", "  }]"],
    ["dim", "}"],
    ["tag", "</script>"],
  ];
  const tone: Record<string, string> = { tag: "text-[#8ab4f8]", dim: "text-ink-3", key: "text-ink-2", str: "text-good" };
  return (
    <div aria-hidden="true" className="mt-8 overflow-hidden rounded-lg border border-white/[0.06] bg-surface-ink/70">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2 font-sub text-[12px] text-ink-3">
        <span>AEO-1 · Add FAQ schema</span>
        <span className="rounded border border-white/[0.08] px-1.5 py-0.5">Copy fix</span>
      </div>
      <pre className="overflow-hidden px-4 py-3 font-[ui-monospace,SFMono-Regular,Menlo,Consolas,monospace] text-[12.5px] leading-[1.75]">
        {lines.map(([t, text], i) => (
          <m.span
            key={i}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: 0.1 + i * 0.05 }}
            className={`block whitespace-pre ${tone[t]}`}
          >
            <span className="mr-4 inline-block w-4 text-right text-white/20">{i + 1}</span>
            {text}
          </m.span>
        ))}
      </pre>
    </div>
  );
}

const LOG = ["Fetching page · 212 ms", "robots.txt, sitemap, llms.txt", "19 SEO checks", "Question headings and schema", "8 AI crawlers", "Asking 3 AI models"];

/** Live progress log, the way an audit streams in. */
export function LiveDemo() {
  const ref = useRef<HTMLUListElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      const t = setTimeout(() => setStep(LOG.length), 0);
      return () => clearTimeout(t);
    }
    const timer = setInterval(() => setStep((s) => (s >= LOG.length ? s : s + 1)), 520);
    return () => clearInterval(timer);
  }, [inView, reduce]);

  return (
    <ul ref={ref} aria-hidden="true" className="mt-8 space-y-2.5 font-sub text-[13px]">
      {LOG.map((l, i) => (
        <li key={l} className={`flex items-center gap-2.5 transition-colors duration-300 ${i < step ? "text-ink-2" : i === step ? "text-ink" : "text-white/25"}`}>
          {i < step ? (
            <Check className="size-3.5 text-good" />
          ) : i === step ? (
            <LoaderCircle className="size-3.5 animate-spin text-ink-2" />
          ) : (
            <span className="grid size-3.5 place-items-center">
              <span className="size-1 rounded-full bg-white/20" />
            </span>
          )}
          {l}
        </li>
      ))}
    </ul>
  );
}

const STEPS = [
  { n: "01", title: "Paste a URL", body: "Any public page: homepage, product page or blog post." },
  { n: "02", title: "We crawl and test", body: "HTML, robots.txt, sitemap, schema, links and a mobile Lighthouse run." },
  { n: "03", title: "AI engines are checked", body: "Crawler access, llms.txt, entity signals and live AI answers." },
  { n: "04", title: "You get the fix list", body: "Every issue ranked by impact, with the exact change to make." },
];

/** Four-step timeline whose hairline fills as the section scrolls through view. */
export function Timeline() {
  const ref = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 85%", "end 55%"] });
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 24 });
  const reduce = useReducedMotion();

  return (
    <div className="relative mt-16">
      <div aria-hidden="true" className="absolute left-0 right-0 top-[11px] hidden h-px bg-white/[0.08] lg:block">
        <m.div className="h-px origin-left bg-gradient-to-r from-white/10 via-white/60 to-white" style={{ scaleX: reduce ? 1 : scaleX }} />
      </div>
      <ol ref={ref} className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <m.li
            key={s.n}
            initial={reduce ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, ease: EASE, delay: i * 0.1 }}
            className="relative"
          >
            <span className="relative z-10 grid size-6 place-items-center rounded-full border border-white/20 bg-paper">
              <span className="size-1.5 rounded-full bg-ink" />
            </span>
            <p className="mt-6 font-mono text-[13px] text-ink-3">{s.n}</p>
            <h3 className="mt-2 text-[20px] font-medium tracking-[-0.015em]">{s.title}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-3">{s.body}</p>
          </m.li>
        ))}
      </ol>
    </div>
  );
}
