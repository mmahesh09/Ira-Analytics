"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Sector,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { scoreTone, type Tone } from "@/lib/format";

// Recharts paints SVG attributes, so colors are literal (match globals.css tokens)
export const COLOR = { good: "#3ccf91", warn: "#f59e0b", bad: "#ef4444", ink: "#fafafa", ink3: "#a1a1aa", line: "rgba(255,255,255,0.08)", track: "rgba(255,255,255,0.06)" };
const TONE_COLOR: Record<Tone, string> = { good: COLOR.good, warn: COLOR.warn, bad: COLOR.bad };
const DURATION = 700;

export type Severity = "fail" | "warn" | "pass";

const reducedQuery = "(prefers-reduced-motion: reduce)";
const subscribeMotion = (cb: () => void) => {
  const mq = window.matchMedia(reducedQuery);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
/** true when charts may animate */
function useAnimate() {
  return !useSyncExternalStore(subscribeMotion, () => window.matchMedia(reducedQuery).matches, () => true);
}

/** Recharts passes the original data row as `payload` on click/hover entries. */
function rowOf<T>(entry: unknown): T | undefined {
  return (entry as { payload?: T } | undefined)?.payload;
}

type TipPayload = { name?: string | number; value?: number | string; color?: string; fill?: string; payload?: Record<string, unknown> };
function ChartTip({ active, payload, label, hint }: { active?: boolean; payload?: TipPayload[]; label?: string | number; hint?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/[0.1] bg-[#141516]/95 px-3 py-2 font-sub text-[12.5px] shadow-[0_12px_32px_rgb(0_0_0/0.5)] backdrop-blur">
      {label != null && <p className="mb-1 text-ink-3">{label}</p>}
      {payload.map((p) => (
        <p key={String(p.name)} className="flex items-center gap-2 text-ink">
          <span className="size-2 rounded-full" style={{ background: p.color ?? p.fill }} />
          {p.name}: <span className="tabular-nums">{p.value}</span>
        </p>
      ))}
      {hint && <p className="mt-1.5 text-[11.5px] text-ink-3">{hint}</p>}
    </div>
  );
}

/** 240° gauge with the score in the middle. */
export function ScoreGauge({ score, size = 112, label, caption, color }: { score: number; size?: number; label: string; caption?: ReactNode; color?: string }) {
  const animate = useAnimate();
  const fill = color ?? TONE_COLOR[scoreTone(score)];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${score} out of 100`}>
      <RadialBarChart width={size} height={size} innerRadius="80%" outerRadius="100%" startAngle={210} endAngle={-30} data={[{ value: score }]} barSize={size * 0.085}>
        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
        <RadialBar dataKey="value" cornerRadius={size} fill={fill} background={{ fill: COLOR.track }} isAnimationActive={animate} animationDuration={DURATION} animationEasing="ease-out" />
      </RadialBarChart>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display font-semibold leading-none tracking-[-0.03em] tabular-nums" style={{ fontSize: size * 0.3, color: fill }}>
          {score}
        </span>
        {caption && <span className="mt-1 font-sub text-[11px] text-ink-3">{caption}</span>}
      </div>
    </div>
  );
}

/** Module scores on one shape, against a dashed "strong" line at 80. Module names are clickable. */
export function VisibilityRadar({ data, onSelect }: { data: { key: string; module: string; score: number }[]; onSelect?: (key: string) => void }) {
  const animate = useAnimate();
  const rows = data.map((d) => ({ ...d, target: 80 }));
  const byLabel = new Map(data.map((d) => [d.module, d]));
  return (
    <div className="h-[260px] w-full" role="img" aria-label={`Visibility profile: ${data.map((d) => `${d.module} ${d.score}`).join(", ")}`}>
      <ResponsiveContainer>
        <RadarChart data={rows} outerRadius="70%">
          <PolarGrid stroke={COLOR.line} />
          <PolarAngleAxis
            dataKey="module"
            tick={(props: { x?: number | string; y?: number | string; textAnchor?: string; payload?: { value: string } }) => {
              const d = byLabel.get(props.payload?.value ?? "");
              return (
                <text
                  x={props.x}
                  y={props.y}
                  textAnchor={props.textAnchor as "start" | "middle" | "end"}
                  dominantBaseline="central"
                  onClick={() => d && onSelect?.(d.key)}
                  className={onSelect ? "cursor-pointer fill-ink-3 transition-colors hover:fill-ink" : "fill-ink-3"}
                  fontSize={12}
                >
                  {props.payload?.value} <tspan fill={COLOR.ink} fontWeight={600}>{d?.score}</tspan>
                </text>
              );
            }}
          />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Radar name="Strong (80)" dataKey="target" stroke="rgba(255,255,255,0.25)" strokeDasharray="4 4" fill="none" isAnimationActive={false} />
          <Radar
            name="Score"
            dataKey="score"
            stroke={COLOR.ink}
            strokeWidth={1.5}
            fill={COLOR.ink}
            fillOpacity={0.12}
            dot={{ r: 3.5, fill: COLOR.ink }}
            activeDot={{ r: 6, fill: COLOR.ink, stroke: "#08090a", strokeWidth: 2 }}
            isAnimationActive={animate}
            animationDuration={DURATION}
          />
          <Tooltip content={<ChartTip hint={onSelect ? "Click a module name to open it" : undefined} />} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

const SEVERITIES: { key: Severity; name: string; color: string }[] = [
  { key: "fail", name: "Critical", color: COLOR.bad },
  { key: "warn", name: "Improve", color: COLOR.warn },
  { key: "pass", name: "Passed", color: COLOR.good },
];

/** Hover a slice to read it, click a slice (or legend item) to filter the issue list. */
export function SeverityDonut({
  counts,
  selected,
  onSelect,
}: {
  counts: Record<Severity, number>;
  selected: Severity | null;
  onSelect: (s: Severity | null) => void;
}) {
  const animate = useAnimate();
  const [hover, setHover] = useState<number | null>(null);
  const data = SEVERITIES.map((s) => ({ ...s, value: counts[s.key] }));
  const total = data.reduce((s, d) => s + d.value, 0);
  const focus = hover != null ? data[hover] : selected ? data.find((d) => d.key === selected) : undefined;
  const toggle = (key: Severity) => onSelect(selected === key ? null : key);

  return (
    <div className="flex items-center gap-5">
      <div className="relative size-[136px] shrink-0" role="img" aria-label={`${total} checks: ${counts.fail} critical, ${counts.warn} to improve, ${counts.pass} passed`}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="68%"
              outerRadius="92%"
              paddingAngle={2}
              stroke="none"
              startAngle={90}
              endAngle={-270}
              isAnimationActive={animate}
              animationDuration={DURATION}
              onMouseEnter={(_, i) => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onClick={(_, i) => toggle(data[i].key)}
              activeShape={(props: object) => <Sector {...props} outerRadius={((props as { outerRadius: number }).outerRadius ?? 0) + 5} />}
              style={{ cursor: "pointer", outline: "none" }}
            >
              {data.map((d) => (
                <Cell key={d.key} fill={d.color} fillOpacity={selected && selected !== d.key ? 0.22 : 1} />
              ))}
            </Pie>
            <Tooltip content={() => null} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-[28px] font-semibold leading-none tabular-nums" style={{ color: focus?.color }}>
            {focus ? focus.value : total}
          </span>
          <span className="mt-1 font-sub text-[11px] text-ink-3">{focus ? focus.name.toLowerCase() : "checks"}</span>
        </div>
      </div>
      <ul className="space-y-1 font-sub text-[13.5px]">
        {data.map((d) => (
          <li key={d.key}>
            <button
              type="button"
              onClick={() => toggle(d.key)}
              aria-pressed={selected === d.key}
              className={`flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-1 transition-colors ${selected === d.key ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"} ${selected && selected !== d.key ? "opacity-50" : ""}`}
            >
              <span className="size-2 rounded-full" style={{ background: d.color }} />
              <span className="w-16 text-left text-ink-3">{d.name}</span>
              <span className="tabular-nums text-ink">{d.value}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One stacked bar per module. Clicking a segment opens that module filtered to that kind of check. */
export function ChecksByModule({
  data,
  onSelect,
}: {
  data: { key: string; module: string; pass: number; warn: number; fail: number }[];
  onSelect: (key: string, status: Severity) => void;
}) {
  const animate = useAnimate();
  const click = (status: Severity) => (entry: unknown) => {
    const row = rowOf<{ key: string }>(entry);
    if (row) onSelect(row.key, status);
  };
  return (
    <div className="h-[170px] w-full" role="img" aria-label={data.map((d) => `${d.module}: ${d.fail} critical, ${d.warn} improve, ${d.pass} passed`).join("; ")}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }} barSize={12}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="module" width={48} tick={{ fill: COLOR.ink3, fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTip hint="Click a segment to open those checks" />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
          <Bar dataKey="fail" name="Critical" stackId="s" fill={COLOR.bad} radius={[3, 0, 0, 3]} isAnimationActive={animate} animationDuration={DURATION} onClick={click("fail")} style={{ cursor: "pointer" }} />
          <Bar dataKey="warn" name="Improve" stackId="s" fill={COLOR.warn} isAnimationActive={animate} animationDuration={DURATION} onClick={click("warn")} style={{ cursor: "pointer" }} />
          <Bar dataKey="pass" name="Passed" stackId="s" fill={COLOR.good} fillOpacity={0.75} radius={[0, 3, 3, 0]} isAnimationActive={animate} animationDuration={DURATION} onClick={click("pass")} style={{ cursor: "pointer" }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Current vs projected score per module, for the fix simulator. */
export function ProjectionBars({ data }: { data: { module: string; current: number; projected: number }[] }) {
  const animate = useAnimate();
  return (
    <div className="h-[220px] w-full" role="img" aria-label={data.map((d) => `${d.module}: ${d.current} now, ${d.projected} after fixes`).join("; ")}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 22, right: 4, bottom: 0, left: -20 }} barGap={4} barCategoryGap="26%">
          <XAxis dataKey="module" tick={{ fill: COLOR.ink3, fontSize: 12 }} axisLine={{ stroke: COLOR.line }} tickLine={false} />
          <YAxis domain={[0, 100]} ticks={[0, 50, 80, 100]} tick={{ fill: COLOR.ink3, fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
          <Bar dataKey="current" name="Now" fill="rgba(255,255,255,0.18)" radius={[4, 4, 0, 0]} isAnimationActive={animate} animationDuration={DURATION} />
          <Bar dataKey="projected" name="After fixes" radius={[4, 4, 0, 0]} isAnimationActive={animate} animationDuration={400}>
            {data.map((d) => (
              <Cell key={d.module} fill={TONE_COLOR[scoreTone(d.projected)]} />
            ))}
            <LabelList
              dataKey="projected"
              position="top"
              content={(props: { x?: number | string; y?: number | string; width?: number | string; index?: number }) => {
                const d = data[props.index ?? 0];
                const gain = d ? d.projected - d.current : 0;
                if (!gain) return null;
                return (
                  <text x={Number(props.x) + Number(props.width) / 2} y={Number(props.y) - 6} textAnchor="middle" fill={COLOR.good} fontSize={11.5} fontWeight={600}>
                    +{gain}
                  </text>
                );
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Two-part donut (e.g. internal vs external links, allowed vs blocked crawlers). */
export function SplitDonut({ parts, center, caption }: { parts: { name: string; value: number; color: string }[]; center: ReactNode; caption: string }) {
  const animate = useAnimate();
  return (
    <div className="relative size-[120px] shrink-0" role="img" aria-label={parts.map((p) => `${p.name}: ${p.value}`).join(", ")}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={parts}
            dataKey="value"
            nameKey="name"
            innerRadius="72%"
            outerRadius="94%"
            paddingAngle={parts.every((p) => p.value > 0) ? 3 : 0}
            stroke="none"
            startAngle={90}
            endAngle={-270}
            isAnimationActive={animate}
            animationDuration={DURATION}
            activeShape={(props: object) => <Sector {...props} outerRadius={((props as { outerRadius: number }).outerRadius ?? 0) + 4} />}
          >
            {parts.map((p) => (
              <Cell key={p.name} fill={p.color} />
            ))}
          </Pie>
          <Tooltip content={<ChartTip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-[22px] font-semibold leading-none tabular-nums">{center}</span>
        <span className="mt-1 font-sub text-[11px] text-ink-3">{caption}</span>
      </div>
    </div>
  );
}

/** Keywords per Google position band. Click a column to filter the keyword table. */
export function PositionsChart({ data, selected, onSelect }: { data: { band: string; count: number }[]; selected: string | null; onSelect: (band: string | null) => void }) {
  const animate = useAnimate();
  return (
    <div className="h-[220px] w-full" role="img" aria-label={data.map((d) => `positions ${d.band}: ${d.count} keywords`).join(", ")}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: -16 }} barCategoryGap="28%">
          <XAxis dataKey="band" tick={{ fill: COLOR.ink3, fontSize: 12 }} axisLine={{ stroke: COLOR.line }} tickLine={false} tickFormatter={(b) => `#${b}`} />
          <YAxis tick={{ fill: COLOR.ink3, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip content={<ChartTip hint="Click to filter the keyword table" />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
          <Bar
            dataKey="count"
            name="Keywords"
            radius={[4, 4, 0, 0]}
            isAnimationActive={animate}
            animationDuration={DURATION}
            style={{ cursor: "pointer" }}
            onClick={(entry: unknown) => {
              const band = rowOf<{ band: string }>(entry)?.band;
              if (band) onSelect(selected === band ? null : band);
            }}
          >
            {data.map((d, i) => (
              <Cell key={d.band} fill={selected ? (selected === d.band ? COLOR.ink : "rgba(255,255,255,0.14)") : i === 0 ? COLOR.ink : "rgba(255,255,255,0.22)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
