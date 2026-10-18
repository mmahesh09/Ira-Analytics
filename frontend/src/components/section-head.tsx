import { Reveal } from "@/components/reveal";
import { splitTitle } from "@/components/marketing/chapters";

/** Section opener: mono eyebrow, white + purple headline, muted paragraph. */
export function SectionHead({ label, title, body, className = "", as: Heading = "h2" }: { label: string; title: string; body?: string; className?: string; as?: "h1" | "h2" }) {
  return (
    <Reveal className={className}>
      <p className="eyebrow flex items-center gap-2.5">
        <span className="size-1.5 rounded-full bg-cobalt shadow-[0_0_8px_var(--cobalt)]" />
        {label}
      </p>
      <Heading className="mt-5 max-w-[18ch] text-[clamp(2.25rem,5vw,3.75rem)] font-semibold leading-[1.04] tracking-[-0.03em]">
        <span className="text-gradient pb-1">{splitTitle(title)[0]}</span> <span className="text-accent pb-1">{splitTitle(title)[1]}</span>
      </Heading>
      {body && <p className="mt-5 max-w-[52ch] text-[18px] leading-relaxed text-ink-3">{body}</p>}
    </Reveal>
  );
}
