import { Suspense } from "react";
import { SiteSettings } from "@/components/app/site-pages";

export default function SiteSettingsPage() {
  return (
    <Suspense>
      <SiteSettings />
    </Suspense>
  );
}
