import type { Metadata } from "next";
import { FeedbackForm } from "@/components/feedback/feedback-form";

export const metadata: Metadata = {
  title: "Share feedback",
  description: "Tell the Rankwise team what works, what doesn't and what to build next. Takes about two minutes.",
};

export default function FeedbackPage() {
  return (
    <section className="mx-auto max-w-[820px] px-4 pb-24 pt-20 sm:px-6 lg:pt-28">
      <p className="eyebrow flex items-center gap-2.5">
        <span className="size-1.5 rounded-full bg-cobalt shadow-[0_0_10px_var(--cobalt)]" /> Feedback
      </p>
      <h1 className="mt-5 font-display text-[clamp(2.25rem,4.5vw,3.5rem)] font-bold leading-[1.05] tracking-[-0.03em]">
        Help us build <span className="text-accent">a better Rankwise</span>
      </h1>
      <p className="mt-5 max-w-[56ch] text-[17px] leading-relaxed text-ink-2">
        Three short steps, about two minutes. Only a few questions are required, and you can go back and change any answer before you send.
      </p>
      <div className="mt-10">
        <FeedbackForm />
      </div>
    </section>
  );
}
