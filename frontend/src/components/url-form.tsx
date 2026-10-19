"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Globe } from "lucide-react";
import { cleanUrl } from "@/lib/api";

export function UrlForm({
  defaultValue = "",
  autoFocus = false,
  align = "left",
  tone = "dark",
  showLabel = false,
}: {
  defaultValue?: string;
  autoFocus?: boolean;
  align?: "left" | "center";
  /** "light" for .theme-light sections: white field with a soft shadow */
  tone?: "dark" | "light";
  /** visible label above the field (the hero); otherwise it is screen-reader only */
  showLabel?: boolean;
}) {
  const router = useRouter();
  const inputId = useId();
  const errorId = useId();
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    const url = cleanUrl(value);
    if (!url) {
      setError("Enter a website address, like example.com");
      return;
    }
    setError(null);
    setPending(true);
    router.push(`/audit?url=${encodeURIComponent(url)}`);
  }

  return (
    <form onSubmit={submit} noValidate className={`w-full max-w-[560px] ${align === "center" ? "mx-auto" : ""}`}>
      <label htmlFor={inputId} className={showLabel ? "mb-2.5 block font-sub text-[14px] font-medium text-ink-2" : "sr-only"}>
        Website to audit
      </label>
      <div
        className={`flex items-center gap-2 rounded-full border p-1.5 pl-5 transition-[border-color,box-shadow] duration-200 ${
          tone === "light"
            ? "bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04),0_8px_28px_rgb(0_0_0/0.07)] focus-within:border-black/25 focus-within:shadow-[0_0_0_4px_rgb(147_51_234/0.14)]"
            : "bg-white/[0.035] shadow-[inset_0_1px_0_rgb(255_255_255/0.05)] focus-within:border-cobalt/60 focus-within:shadow-[0_0_0_4px_rgb(191_90_242/0.15)]"
        } ${error ? "border-bad/70" : tone === "light" ? "border-black/[0.08]" : "border-white/[0.1]"}`}
      >
        <Globe aria-hidden="true" className="size-[18px] shrink-0 text-ink-3" />
        <input
          id={inputId}
          type="text"
          inputMode="url"
          autoComplete="url"
          spellCheck={false}
          autoFocus={autoFocus}
          placeholder="e.g. yourcompany.com"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className="h-12 w-full min-w-0 bg-transparent font-sub text-[17px] text-ink outline-none placeholder:text-ink-3 focus-visible:outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="flex h-11 shrink-0 cursor-pointer items-center gap-2 btn-brand rounded-full px-5 font-sub text-[14.5px] font-medium disabled:cursor-wait disabled:opacity-70"
        >
          {pending ? "Starting…" : "Run audit"}
          <ArrowRight aria-hidden="true" className="size-4" />
        </button>
      </div>
      <p id={errorId} role="alert" className={`mt-2 min-h-5 font-sub text-[14px] text-bad ${align === "center" ? "text-center" : ""}`}>
        {error}
      </p>
    </form>
  );
}
