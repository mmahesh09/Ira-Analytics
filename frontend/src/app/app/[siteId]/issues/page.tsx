import { Suspense } from "react";
import type { Metadata } from "next";
import { IssuesPage } from "@/components/app/monitoring";

export const metadata: Metadata = { title: "Issues" };

export default function Issues() {
  return (
    <Suspense>
      <IssuesPage />
    </Suspense>
  );
}
