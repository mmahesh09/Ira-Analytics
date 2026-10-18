import { Suspense } from "react";
import type { Metadata } from "next";
import { AppShell } from "@/components/app/app-shell";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };

export default function AppLayout({ children }: LayoutProps<"/app">) {
  return (
    <Suspense>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
