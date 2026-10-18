import type { Metadata } from "next";
import { Suspense } from "react";
import { AuditView } from "@/components/audit/audit-view";

export const metadata: Metadata = { title: "Audit report" };

export default function AuditPage() {
  return (
    <Suspense fallback={<div className="mx-auto h-64 w-full max-w-6xl animate-pulse px-4 pt-10 sm:px-6" aria-busy="true" />}>
      <AuditView />
    </Suspense>
  );
}
