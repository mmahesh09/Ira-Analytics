"use client";

import { createContext, useContext, useState } from "react";
import Link from "next/link";
import { Check as CheckMark, Copy, LoaderCircle, Sparkles } from "lucide-react";
import { ApiError, apiFetch } from "@/lib/api";
import type { Site } from "@/lib/types";
import { LengthMeter } from "./infographics";

/** The audited page; provided by the report so any check can offer an AI rewrite. */
export const RewriteTarget = createContext<{ url: string; domain: string } | null>(null);

type Field = "title" | "description" | "h1" | "faq";

/** Which checks get a "Rewrite with AI" button, and what they rewrite. */
export const REWRITE_FIELD: Record<string, Field> = {
  title: "title",
  "meta-description": "description",
  h1: "h1",
  "concise-answers": "faq",
};

const FIELD_LABEL: Record<Field, string> = { title: "Title", description: "Meta description", h1: "H1", faq: "Answer" };

interface RewriteResult {
  current: string;
  question: string | null;
  ideal: [number, number];
  options: { text: string; length: number; in_range: boolean; reason: string }[];
  used: number;
  limit: number;
}

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "signin" }
  | { kind: "nosite" }
  | { kind: "error"; message: string }
  | { kind: "done"; result: RewriteResult };

const bare = (host: string) => host.toLowerCase().replace(/^www\./, "");

function CopyText({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() =>
        navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        })
      }
      aria-label="Copy suggestion"
      className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md px-2 py-1 font-sub text-[12px] text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink"
    >
      {copied ? <CheckMark aria-hidden="true" className="size-3.5 text-good" /> : <Copy aria-hidden="true" className="size-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

/** AI Content Optimization: three rewrites side by side with length meters. Needs an account and the site added. */
export function AiRewrite({ field }: { field: Field }) {
  const target = useContext(RewriteTarget);
  const [state, setState] = useState<State>({ kind: "idle" });
  if (!target) return null;

  async function run() {
    setState({ kind: "loading" });
    try {
      const sites = await apiFetch<Site[]>("/sites");
      const site = sites.find((s) => bare(s.domain) === bare(target!.domain));
      if (!site) return setState({ kind: "nosite" });
      const result = await apiFetch<RewriteResult>(`/sites/${site.id}/rewrite`, { body: { field, url: target!.url } });
      setState({ kind: "done", result });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return setState({ kind: "signin" });
      setState({ kind: "error", message: err instanceof ApiError ? err.message : "Couldn't reach the server. Try again." });
    }
  }

  const button = (
    <button
      type="button"
      onClick={run}
      disabled={state.kind === "loading"}
      className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-cobalt/30 bg-cobalt-soft px-4 font-sub text-[13px] font-medium text-ink transition-colors hover:border-cobalt/60 disabled:cursor-wait disabled:opacity-70"
    >
      {state.kind === "loading" ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin text-cobalt" /> : <Sparkles aria-hidden="true" className="size-4 text-cobalt" />}
      {state.kind === "loading" ? "Writing suggestions…" : state.kind === "done" ? "Write three more" : "Rewrite with AI"}
    </button>
  );

  return (
    <div className="mt-3" aria-live="polite">
      {button}
      {state.kind === "signin" && (
        <p className="mt-2 font-sub text-[13px] text-ink-3">
          <Link href="/signup" className="font-medium text-cobalt hover:underline">
            Create a free account
          </Link>{" "}
          to get AI rewrites for your pages.
        </p>
      )}
      {state.kind === "nosite" && (
        <p className="mt-2 font-sub text-[13px] text-ink-3">
          Add {target.domain} to{" "}
          <Link href="/app" className="font-medium text-cobalt hover:underline">
            your sites
          </Link>{" "}
          first, then rewrite its pages with AI.
        </p>
      )}
      {state.kind === "error" && <p className="mt-2 font-sub text-[13px] text-bad">{state.message}</p>}
      {state.kind === "done" && (
        <div className="mt-4 space-y-3">
          {state.result.question && <p className="font-sub text-[13px] text-ink-3">Question: “{state.result.question}”</p>}
          <div className="rounded-lg border border-line bg-white/[0.02] p-3">
            <p className="eyebrow text-[10.5px]">Now</p>
            <p className="mt-1 text-[14px] text-ink-2">{state.result.current || "(missing)"}</p>
            <div className="mt-3">
              <LengthMeter label={FIELD_LABEL[field]} length={state.result.current.length} ideal={state.result.ideal} max={Math.round(state.result.ideal[1] * 1.4)} />
            </div>
          </div>
          <ol className="space-y-2.5">
            {state.result.options.map((o, i) => (
              <li key={o.text} className="rounded-lg border border-cobalt/20 bg-cobalt-soft/40 p-3">
                <div className="flex items-start gap-3">
                  <span className="font-code text-[11px] text-cobalt">{String(i + 1).padStart(2, "0")}</span>
                  <p className="min-w-0 flex-1 text-[14.5px] leading-relaxed text-ink">{o.text}</p>
                  <CopyText text={o.text} />
                </div>
                {o.reason && <p className="mt-1.5 pl-7 font-sub text-[12.5px] text-ink-3">{o.reason}</p>}
                <div className="mt-3 pl-7">
                  <LengthMeter label="Length" length={o.length} ideal={state.result.ideal} max={Math.round(state.result.ideal[1] * 1.4)} />
                </div>
              </li>
            ))}
          </ol>
          <p className="font-sub text-[12px] text-ink-3">
            {state.result.used} of {state.result.limit} AI rewrites used this month · Review before publishing.
          </p>
        </div>
      )}
    </div>
  );
}
