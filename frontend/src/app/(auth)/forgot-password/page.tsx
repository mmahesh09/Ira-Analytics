import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth-recovery";

export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
