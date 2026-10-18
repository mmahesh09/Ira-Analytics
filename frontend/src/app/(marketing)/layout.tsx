import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { RevealObserver } from "@/components/reveal-observer";

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <div aria-hidden="true" className="rails" />
      <SiteHeader />
      <main id="main" className="flex flex-1 flex-col">
        {children}
      </main>
      <SiteFooter />
      <RevealObserver />
    </>
  );
}
