import Link from "next/link";
import { ArrowRight, MessageSquareHeart } from "lucide-react";
import { Reveal } from "@/components/reveal";

const ASKS = ["What works for you", "What gets in the way", "What we should build next"];

/** Homepage invitation to the 3-step feedback form (/feedback). Every answer is read and copied to the team's sheet. */
export function FeedbackBand() {
  return (
    <section aria-labelledby="feedback-band" className="relative border-t border-line bg-paper">
      <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 lg:py-20">
        <Reveal>
          <div className="panel relative isolate overflow-hidden rounded-[24px] p-7 sm:p-10">
            <div aria-hidden="true" className="console-glow pointer-events-none absolute -right-24 -top-24 -z-10 size-[420px]" />
            <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <div>
                <p className="eyebrow flex items-center gap-2.5">
                  <MessageSquareHeart aria-hidden="true" className="size-4 text-cobalt" /> Feedback
                </p>
                <h2 id="feedback-band" className="t-h2 mt-4 max-w-[18ch]">
                  Help us make <span className="text-accent">Rankwise better.</span>
                </h2>
                <p className="t-lead mt-4 max-w-[50ch]">
                  Two minutes, three short steps. Every answer goes straight to the people building Rankwise and shapes what we fix next.
                </p>
              </div>
              <div>
                <ul className="space-y-2.5 font-sub text-[14.5px] text-ink-2">
                  {ASKS.map((ask) => (
                    <li key={ask} className="flex items-center gap-2.5">
                      <span aria-hidden="true" className="size-1.5 rounded-full bg-cobalt" /> {ask}
                    </li>
                  ))}
                </ul>
                <Link href="/feedback" className="btn-brand mt-7 inline-flex h-12 items-center gap-2 rounded-full px-6 font-sub text-[15px] font-medium">
                  Share feedback <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
                <p className="mt-3 font-sub text-[12.5px] text-ink-3">Name and email are optional.</p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
