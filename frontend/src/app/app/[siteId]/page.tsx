import { Suspense } from "react";
import { SiteOverview } from "@/components/app/site-pages";

export default function SitePage() {
  return (
    <Suspense>
      <SiteOverview />
    </Suspense>
  );
}
