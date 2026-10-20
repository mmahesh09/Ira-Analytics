import type { Metadata } from "next";
import { TwoFactorForm } from "@/components/auth-recovery";

export const metadata: Metadata = { title: "Two-step verification", robots: { index: false } };

export default function TwoFactorPage() {
  return <TwoFactorForm />;
}
