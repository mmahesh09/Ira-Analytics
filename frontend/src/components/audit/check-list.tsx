"use client";

import { useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import { Check as CheckMark, ChevronDown, CircleCheck, CircleX, Copy, Info, TriangleAlert, Wrench } from "lucide-react";
import type { Check, Status } from "@/lib/types";

const STATUS_META: Record<Status, { icon: typeof Info; className: string; chip: string; label: string }> = {
  fail: { icon: CircleX, className: "text-bad", chip: "bg-bad-soft text-bad", label: "Critical" },
  warn: { icon: TriangleAlert, className: "text-warn", chip: "bg-warn-soft text-warn", label: "Improve" },
  pass: { icon: CircleCheck, className: "text-good", chip: "bg-good-soft text-good", label: "Passed" },
  info: { icon: Info, className: "text-ink-3", chip: "bg-surface-3 text-ink-2", label: "Info" },
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md px-2 py-1 font-sub text-[12px] text-ink-3 transition-colors duration-200 hover:bg-surface-3 hover:text-ink"
      aria-label="Copy fix"
    >
      {copied ? <CheckMark className="size-3.5 text-good" /> : <Copy className="size-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

/** One check as an expandable card. Problems open by default so the fix is visible immediately. */
export function CheckItem({ check, tag }: { check: Check; tag?: string }) {
  const meta = STATUS_META[check.status];
  const Icon = meta.icon;
  const expandable = Boolean(check.fix || check.detail);
  const [open, setOpen] = useState(check.status === "fail");

  return (
    <li className="rounded-xl border border-line bg-surface transition-colors duration-200 hover:border-line-strong">
      <button
        type="button"
        onClick={() => expandable && setOpen((o) => !o)}
        aria-expanded={expandable ? open : undefined}
        className={`flex w-full items-start gap-3 p-4 text-left ${expandable ? "cursor-pointer" : "cursor-default"}`}
      >
        <Icon aria-hidden="true" className={`mt-0.5 size-5 shrink-0 ${meta.className}`} />
        <span className="min-w-0 flex-1">
          <span className="font-sub text-[15px] font-medium text-ink">
            <span className="sr-only">{meta.label}: </span>
            {check.title}
          </span>
        </span>
        {tag && <span className="rounded-sm bg-surface-3 px-1.5 py-0.5 font-sub text-[11px] text-ink-3">{tag}</span>}
        <span className={`hidden rounded-full px-2 py-0.5 font-sub text-[11px] font-medium sm:inline ${meta.chip}`}>{meta.label}</span>
        {expandable && (
          <ChevronDown aria-hidden="true" className={`mt-0.5 size-4 shrink-0 text-ink-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && expandable && (
          <m.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
            className="px-4 pb-4 pl-12"
          >
            {check.detail && <p className="break-words text-[14px] leading-relaxed text-ink-3">{check.detail}</p>}
            {check.fix && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
                <Wrench aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-ink-3" />
                <p className="flex-1 text-[14px] leading-relaxed text-ink-2">{check.fix}</p>
                <CopyButton text={check.fix} />
              </div>
            )}
          </m.div>
        )}
      </AnimatePresence>
    </li>
  );
}

type Filter = "all" | "fail" | "warn" | "pass";

/** Filterable list: problems first, sorted by impact. */
export function CheckList({ checks, initialFilter = "all" }: { checks: Check[]; initialFilter?: Filter }) {
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const order: Record<Status, number> = { fail: 0, warn: 1, info: 2, pass: 3 };
  const sorted = [...checks].sort((a, b) => order[a.status] - order[b.status] || b.weight - a.weight);
  const visible = filter === "all" ? sorted : sorted.filter((c) => c.status === filter);
  const count = (s: Status) => checks.filter((c) => c.status === s).length;
  const filters: { key: Filter; label: string; n: number }[] = [
    { key: "all", label: "All", n: checks.length },
    { key: "fail", label: "Critical", n: count("fail") },
    { key: "warn", label: "Improve", n: count("warn") },
    { key: "pass", label: "Passed", n: count("pass") },
  ];

  return (
    <div>
      <div role="group" aria-label="Filter checks" className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border px-4 font-sub text-[13px] font-medium transition-colors duration-200 ${
              filter === f.key ? "border-white/20 bg-white/[0.08] text-ink" : "border-line text-ink-3 hover:border-line-strong hover:text-ink"
            }`}
          >
            {f.label} <span className="font-mono text-ink-3">{f.n}</span>
          </button>
        ))}
      </div>
      <ul className="mt-5 space-y-2.5">
        {visible.map((c) => (
          <CheckItem key={c.id} check={c} />
        ))}
        {!visible.length && <li className="rounded-xl border border-dashed border-line-strong p-6 text-center text-ink-3">Nothing in this filter.</li>}
      </ul>
    </div>
  );
}
