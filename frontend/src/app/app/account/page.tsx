import { Suspense } from "react";
import type { Metadata } from "next";
import { AccountPage } from "@/components/app/account";

export const metadata: Metadata = { title: "Account & security" };

export default function Account() {
  return (
    <Suspense>
      <AccountPage />
    </Suspense>
  );
}
