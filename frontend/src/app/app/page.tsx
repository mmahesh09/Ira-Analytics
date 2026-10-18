import { Suspense } from "react";
import { SitesHome } from "@/components/app/site-pages";

export default function AppHome() {
  return (
    <Suspense>
      <SitesHome />
    </Suspense>
  );
}
