import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { splitTitle } from "@/components/marketing/chapters";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";

export interface FAQItem {
  question: string;
  answer: string;
}

interface FAQProps {
  title: string;
  description: string;
  items: FAQItem[];
  cta?: { label: string; href: string };
}

function FAQ({ title, description, items, cta }: FAQProps) {
  return (
    <div className="w-full py-24 lg:py-36">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.35fr] lg:gap-20">
          <div className="flex flex-col gap-6 lg:sticky lg:top-28 lg:self-start">
            <div>
              <p className="eyebrow flex items-center gap-2.5">
                <span className="size-1.5 rounded-full bg-cobalt shadow-[0_0_8px_var(--cobalt)]" />
                FAQ
              </p>
            </div>
            <div className="flex flex-col gap-4">
              <h2 className="max-w-xl text-left text-[clamp(2.25rem,5vw,3.75rem)] font-semibold leading-[1.04] tracking-[-0.03em]">
                <span className="text-gradient pb-1">{splitTitle(title)[0]}</span> <span className="text-accent pb-1">{splitTitle(title)[1]}</span>
              </h2>
              <p className="max-w-md text-left text-[17px] leading-[1.47] text-ink-3">
                {description}
              </p>
            </div>
            {cta && (
              <div>
                <Button asChild variant="link" className="h-auto gap-1 p-0 text-[17px] font-normal">
                  <Link href={cta.href}>
                    {cta.label} <ArrowRight aria-hidden="true" className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            )}
          </div>
          <Accordion type="single" collapsible className="w-full border-t border-line">
            {items.map((item, index) => (
              <AccordionItem key={item.question} value={`item-${index}`} className="border-line">
                <AccordionTrigger className="cursor-pointer py-6 text-left font-sub text-[19px] font-medium tracking-[-0.01em] hover:no-underline [&>svg]:size-5 [&>svg]:text-ink-3">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="max-w-[60ch] pb-6 text-[17px] leading-[1.47] text-muted-foreground">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </div>
  );
}

export { FAQ };
