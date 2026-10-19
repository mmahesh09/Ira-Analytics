import Link from "next/link";
import type { Metadata } from "next";
import { LegalPage, MailLink, type LegalSection } from "@/components/legal-page";
import { COMPANY } from "@/lib/company";

export const metadata: Metadata = {
  title: "Cookie policy",
  description: "Rankwise uses one strictly necessary sign-in cookie and no tracking or advertising cookies. Here is everything stored in your browser.",
};

const STORED: { name: string; kind: string; purpose: string; lasts: string }[] = [
  {
    name: "better-auth.session_token (or __Secure-better-auth.session_token)",
    kind: "Cookie, first-party, strictly necessary",
    purpose: "Keeps you signed in to your workspace. Only set when you sign in.",
    lasts: "30 days, or until you log out",
  },
  {
    name: "rw_currency",
    kind: "Local storage, first-party, preference",
    purpose: "Remembers whether you chose to see prices in INR or USD.",
    lasts: "Until you clear site data",
  },
  {
    name: "rw_intended_plan",
    kind: "Local storage, first-party, functional",
    purpose: "Remembers the plan you picked before signing up, so Billing can open on it.",
    lasts: "Until you clear site data",
  },
];

const SECTIONS: LegalSection[] = [
  {
    id: "summary",
    heading: "In short",
    body: (
      <p>
        {COMPANY.name} uses <strong>one cookie</strong>, and only to keep you signed in. There are no analytics, advertising or social-media cookies, and
        nothing that tracks you across other websites. Because that cookie is strictly necessary for the service you ask for, we don&rsquo;t show a
        consent banner.
      </p>
    ),
  },
  {
    id: "list",
    heading: "What we store in your browser",
    body: (
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[560px] font-sub text-[14px]">
          <caption className="sr-only">Cookies and browser storage used by Rankwise</caption>
          <thead className="bg-white/[0.02] text-left text-[12.5px] text-ink-3">
            <tr>
              <th scope="col" className="px-4 py-3 font-normal">Name</th>
              <th scope="col" className="px-4 py-3 font-normal">Type</th>
              <th scope="col" className="px-4 py-3 font-normal">Purpose</th>
              <th scope="col" className="px-4 py-3 font-normal">Lasts</th>
            </tr>
          </thead>
          <tbody>
            {STORED.map((row) => (
              <tr key={row.name} className="border-t border-line align-top">
                <td className="px-4 py-3 font-code text-[12.5px] text-ink">{row.name}</td>
                <td className="px-4 py-3 text-ink-2">{row.kind}</td>
                <td className="px-4 py-3 text-ink-2">{row.purpose}</td>
                <td className="px-4 py-3 text-ink-3">{row.lasts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
  },
  {
    id: "third-party",
    heading: "Third parties",
    body: (
      <p>
        When you pay, Razorpay&rsquo;s checkout window opens from razorpay.com and may set its own cookies for fraud prevention and to complete the payment.
        Those are covered by Razorpay&rsquo;s own policies. Our hosting providers (Vercel and Render) may set short-lived technical cookies needed to route and
        protect requests.
      </p>
    ),
  },
  {
    id: "control",
    heading: "Your choices",
    body: (
      <p>
        You can block or delete cookies and site data in your browser settings. If you block the sign-in cookie, you can still read the website and run free
        previews, but you won&rsquo;t be able to sign in to your workspace.
      </p>
    ),
  },
  {
    id: "changes",
    heading: "Changes",
    body: (
      <p>
        If we ever add cookies that aren&rsquo;t strictly necessary, such as analytics, we&rsquo;ll update this page first and ask for your consent before
        setting them. See also our <Link href="/privacy" className="text-ink underline underline-offset-4">privacy policy</Link>. Questions: <MailLink subject="Cookies" />.
      </p>
    ),
  },
];

export default function CookiesPage() {
  return (
    <LegalPage
      label="Cookies"
      title="Cookie policy"
      current="/cookies"
      intro={<p>What {COMPANY.name} stores in your browser, why, and how long it stays.</p>}
      sections={SECTIONS}
    />
  );
}
