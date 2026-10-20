"use client";

import type { ReactNode } from "react";
import { Star } from "lucide-react";
import type { Option } from "@/lib/feedback";

/** Form controls for the feedback form. All are native inputs, so arrow keys, Space and screen readers work as usual. */

export const inputClass =
  "mt-2 h-11 w-full rounded-lg border bg-white/[0.03] px-3.5 text-[15px] text-ink outline-none transition-colors duration-150 placeholder:text-ink-3/70 focus-visible:border-cobalt/70 focus-visible:ring-2 focus-visible:ring-cobalt/25";
const border = (error?: string) => (error ? "border-bad/70" : "border-white/[0.1] hover:border-white/20");

export function ErrorText({ id, error }: { id: string; error?: string }) {
  return error ? (
    <p id={id} className="mt-2 font-sub text-[13px] text-[#f87171]">
      {error}
    </p>
  ) : null;
}

function Legend({ children, required, hint }: { children: ReactNode; required?: boolean; hint?: string }) {
  return (
    <legend className="font-sub text-[15px] font-medium text-ink">
      {children}
      {required ? (
        <span className="ml-1 text-cobalt" aria-hidden="true">
          *
        </span>
      ) : (
        <span className="ml-2 font-sub text-[12.5px] font-normal text-ink-3">Optional</span>
      )}
      {hint && <span className="mt-1 block font-sub text-[13px] font-normal text-ink-3">{hint}</span>}
    </legend>
  );
}

export function TextField({
  name,
  label,
  value,
  onChange,
  error,
  type = "text",
  autoComplete,
  maxLength,
  placeholder,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: string;
  autoComplete?: string;
  maxLength?: number;
  placeholder?: string;
}) {
  const id = `fb-${name}`;
  return (
    <div>
      <label htmlFor={id} className="font-sub text-[15px] font-medium text-ink">
        {label} <span className="ml-1 font-sub text-[12.5px] font-normal text-ink-3">Optional</span>
      </label>
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${inputClass} ${border(error)}`}
      />
      <ErrorText id={`${id}-error`} error={error} />
    </div>
  );
}

export function TextArea({
  name,
  label,
  value,
  onChange,
  error,
  maxLength,
  placeholder,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  maxLength: number;
  placeholder?: string;
}) {
  const id = `fb-${name}`;
  const near = value.length > maxLength * 0.8;
  return (
    <div>
      <label htmlFor={id} className="font-sub text-[15px] font-medium text-ink">
        {label} <span className="ml-1 font-sub text-[12.5px] font-normal text-ink-3">Optional</span>
      </label>
      <textarea
        id={id}
        name={name}
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={[error && `${id}-error`, near && `${id}-count`].filter(Boolean).join(" ") || undefined}
        className={`${inputClass} ${border(error)} h-auto min-h-[96px] resize-y py-3 leading-relaxed`}
      />
      {near && (
        <p id={`${id}-count`} className="mt-1 text-right font-mono text-[12px] text-ink-3">
          {value.length}/{maxLength}
        </p>
      )}
      <ErrorText id={`${id}-error`} error={error} />
    </div>
  );
}

/** Text box shown under a group when "Other" is chosen. */
export function OtherInput({ name, label, value, onChange, error }: { name: string; label: string; value: string; onChange: (v: string) => void; error?: string }) {
  const id = `fb-${name}`;
  return (
    <div className="mt-3">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={120}
        placeholder={label}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${inputClass} ${border(error)} mt-0`}
      />
      <ErrorText id={`${id}-error`} error={error} />
    </div>
  );
}

const chip =
  "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border px-3.5 py-2.5 font-sub text-[14px] transition-colors duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-cobalt/50";
const chipState = (checked: boolean) =>
  checked ? "border-cobalt/60 bg-cobalt-soft text-ink" : "border-white/[0.09] bg-white/[0.02] text-ink-2 hover:border-white/20 hover:text-ink";

/** Single choice as tappable cards (native radios). */
export function ChoiceGroup<V extends string>({
  name,
  legend,
  options,
  value,
  onChange,
  error,
  required,
  columns = 2,
  children,
}: {
  name: string;
  legend: string;
  options: readonly Option<V>[];
  value: V | "";
  onChange: (v: V) => void;
  error?: string;
  required?: boolean;
  columns?: 1 | 2;
  children?: ReactNode;
}) {
  const errorId = `fb-${name}-error`;
  return (
    <fieldset aria-describedby={error ? errorId : undefined}>
      <Legend required={required}>{legend}</Legend>
      <div className={`mt-3 grid gap-2 ${columns === 2 ? "sm:grid-cols-2" : ""}`}>
        {options.map((o) => (
          <label key={o.value} className={`${chip} ${chipState(value === o.value)}`}>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="size-4 shrink-0 accent-[#9333ea]"
            />
            {o.label}
          </label>
        ))}
      </div>
      {children}
      <ErrorText id={errorId} error={error} />
    </fieldset>
  );
}

/** Multiple choice (native checkboxes). */
export function CheckboxGroup<V extends string>({
  name,
  legend,
  hint,
  options,
  value,
  onChange,
}: {
  name: string;
  legend: string;
  hint?: string;
  options: readonly Option<V>[];
  value: V[];
  onChange: (v: V[]) => void;
}) {
  return (
    <fieldset>
      <Legend hint={hint}>{legend}</Legend>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {options.map((o) => {
          const checked = value.includes(o.value);
          return (
            <label key={o.value} className={`${chip} ${chipState(checked)}`}>
              <input
                type="checkbox"
                name={name}
                value={o.value}
                checked={checked}
                onChange={() => onChange(checked ? value.filter((v) => v !== o.value) : [...value, o.value])}
                className="size-4 shrink-0 accent-[#9333ea]"
              />
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

const STAR_WORDS = ["Very poor", "Poor", "Okay", "Good", "Excellent"];

/** 1-5 rating as stars. Radios underneath: arrow keys move, and each star reads as "4 of 5, Good". */
export function StarRating({
  name,
  legend,
  value,
  onChange,
  error,
  low,
  high,
}: {
  name: string;
  legend: string;
  value: number | null;
  onChange: (v: number) => void;
  error?: string;
  low: string;
  high: string;
}) {
  const errorId = `fb-${name}-error`;
  return (
    <fieldset aria-describedby={error ? errorId : undefined}>
      <Legend required>{legend}</Legend>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => {
            const lit = value !== null && n <= value;
            return (
              <label key={n} className="group grid size-11 cursor-pointer place-items-center rounded-lg transition-colors duration-150 hover:bg-white/[0.05] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-cobalt/60">
                <input
                  type="radio"
                  name={name}
                  value={n}
                  checked={value === n}
                  onChange={() => onChange(n)}
                  className="sr-only"
                />
                <span className="sr-only">
                  {n} of 5, {STAR_WORDS[n - 1]}
                </span>
                <Star
                  aria-hidden="true"
                  className={`size-7 transition-transform duration-150 group-hover:scale-110 ${lit ? "fill-cobalt text-cobalt" : "text-ink-3/60"}`}
                  strokeWidth={1.6}
                />
              </label>
            );
          })}
        </div>
        <p className="font-sub text-[13.5px] text-ink-2" aria-hidden="true">
          {value ? STAR_WORDS[value - 1] : `${low} → ${high}`}
        </p>
      </div>
      <ErrorText id={errorId} error={error} />
    </fieldset>
  );
}

/** 0-10 likelihood scale. */
export function ScoreScale({ name, legend, value, onChange, error }: { name: string; legend: string; value: number | null; onChange: (v: number) => void; error?: string }) {
  const errorId = `fb-${name}-error`;
  return (
    <fieldset aria-describedby={error ? errorId : undefined}>
      <Legend required>{legend}</Legend>
      <div className="mt-3 grid grid-cols-6 gap-1.5 sm:grid-cols-11">
        {Array.from({ length: 11 }, (_, n) => (
          <label
            key={n}
            className={`grid h-11 cursor-pointer place-items-center rounded-lg border font-mono text-[14px] transition-colors duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-cobalt/60 ${
              value === n ? "border-cobalt bg-cobalt-fill text-white" : "border-white/[0.09] bg-white/[0.02] text-ink-2 hover:border-white/25 hover:text-ink"
            }`}
          >
            <input type="radio" name={name} value={n} checked={value === n} onChange={() => onChange(n)} className="sr-only" />
            {n}
            <span className="sr-only">{n === 0 ? " — not at all likely" : n === 10 ? " — extremely likely" : ""}</span>
          </label>
        ))}
      </div>
      <div className="mt-2 flex justify-between font-sub text-[12.5px] text-ink-3" aria-hidden="true">
        <span>Not at all likely</span>
        <span>Extremely likely</span>
      </div>
      <ErrorText id={errorId} error={error} />
    </fieldset>
  );
}
