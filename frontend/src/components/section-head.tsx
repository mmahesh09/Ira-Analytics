import { Reveal } from "@/components/reveal";

/** Linear-style section opener: dot label, gradient headline, muted paragraph. */
export function SectionHead({ label, title, body, className = "", as: Heading = "h2" }: { label: string; title: string; body?: string; className?: string; as?: "h1" | "h2" }) {
  return (
    <Reveal className={className}>
      <p className="flex items-center gap-2 font-sub text-[13px] text-ink-3">
        <span className="size-1.5 rounded-full bg-cobalt shadow-[0_0_8px_var(--cobalt)]" />
        {label}
      </p>
      <Heading className="text-gradient mt-5 max-w-[18ch] pb-1 text-[clamp(2.25rem,5vw,3.75rem)] font-semibold leading-[1.04] tracking-[-0.04em]">{title}</Heading>
      {body && <p className="mt-5 max-w-[52ch] text-[18px] leading-relaxed text-ink-3">{body}</p>}
    </Reveal>
  );
}
