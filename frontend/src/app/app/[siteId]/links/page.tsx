import { Suspense } from "react";
import type { Metadata } from "next";
import { LinksPage } from "@/components/app/monitoring";

export const metadata: Metadata = { title: "Broken links" };

export default function Links() {
  return (
    <Suspense>
      <LinksPage />
    </Suspense>
  );
}
