import { Suspense } from "react";
import type { Metadata } from "next";
import { MonitoringPage } from "@/components/app/monitoring";

export const metadata: Metadata = { title: "Monitoring" };

export default function Monitoring() {
  return (
    <Suspense>
      <MonitoringPage />
    </Suspense>
  );
}
