import { Suspense } from "react";
import type { Metadata } from "next";
import { BillingPage } from "@/components/app/billing";

export const metadata: Metadata = { title: "Billing" };

export default function Billing() {
  return (
    <Suspense>
      <BillingPage />
    </Suspense>
  );
}
