import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth-recovery";

// the token is in the URL: keep it out of Referer headers sent to anything this page loads
export const metadata: Metadata = { title: "Choose a new password", robots: { index: false }, referrer: "no-referrer" };

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
