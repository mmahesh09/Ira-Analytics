import { FEATURES, liveCount } from "@/lib/features";
import { MODULES } from "@/lib/format";

/** Hero stats band (Tailark "stats-2" layout, rebuilt on Rankwise tokens). Every number comes from the product itself. */
export function HeroStats({ engines }: { engines: string[] }) {
  const stats = [
    { value: String(FEATURES.length), label: "tools in one audit", note: `${liveCount} live today` },
    { value: String(Object.keys(MODULES).length), label: "areas checked", note: `${Object.values(MODULES).map((m) => m.label).slice(0, 4).join(", ")}…` },
    { value: "~60s", label: "to a full report", note: "Free, no signup" },
    { value: "0", label: "changes to your site", note: "Read-only checks" },
  ];
  return (
    <div className="relative border-t border-line">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <dl className="grid grid-cols-2 lg:grid-cols-4">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={`flex flex-col py-7 ${i % 2 ? "border-l border-line pl-5 sm:pl-8" : "pr-5"} ${i > 1 ? "border-t border-line lg:border-t-0" : ""} lg:px-8 lg:first:pl-0 ${i > 0 ? "lg:border-l lg:border-line" : ""}`}
            >
              {/* the label is the term; the number is shown first, as in the design */}
              <dt className="mt-2 font-sub text-[14.5px] text-ink-2">{s.label}</dt>
              <dd className="order-first font-display text-[clamp(2rem,3.4vw,2.75rem)] font-semibold leading-none tracking-[-0.04em] text-ink">{s.value}</dd>
              <dd className="mt-0.5 font-sub text-[12.5px] text-ink-3">{s.note}</dd>
            </div>
          ))}
        </dl>
        <p className="border-t border-line py-4 font-sub text-[13px] text-ink-3">Checked against {engines.slice(0, 5).join(", ")} and more.</p>
      </div>
    </div>
  );
}
