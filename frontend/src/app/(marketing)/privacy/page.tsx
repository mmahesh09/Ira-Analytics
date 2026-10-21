import Link from "next/link";
import type { Metadata } from "next";
import { LegalPage, MailLink, type LegalSection } from "@/components/legal-page";
import { COMPANY } from "@/lib/company";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "What Rankwise collects, why, who processes it, how long it's kept and how to access or delete your data.",
};

const SECTIONS: LegalSection[] = [
  {
    id: "who",
    heading: "Who we are",
    body: (
      <p>
        {COMPANY.name} is a website-audit service operated from {COMPANY.city}, {COMPANY.region}, {COMPANY.country}. We decide how the personal data
        described here is used, which makes us the data fiduciary (controller) for it. Questions or requests go to <MailLink subject="Privacy request" />.
      </p>
    ),
  },
  {
    id: "collect",
    heading: "What we collect",
    body: (
      <ul>
        <li>
          <strong>Account details:</strong> your name, email address and password. Passwords are stored only as a salted hash by our sign-in system; we
          never see them.
        </li>
        <li>
          <strong>Websites and results:</strong> the domains you add, their settings, audit reports, issue history, broken-link results, alerts and, where
          the accessibility check runs, screenshots of your public pages.
        </li>
        <li>
          <strong>Billing records:</strong> your plan, subscription status, credit balance and usage, and payment references (payment ID, amount, currency,
          status, date). Card, UPI and bank details are entered with Razorpay and never reach our servers.
        </li>
        <li>
          <strong>Free previews without an account:</strong> the URL you enter, and a salted one-way hash of your IP address so we can limit previews per
          day. We don&rsquo;t keep the IP address itself, and preview results are not saved.
        </li>
        <li>
          <strong>Technical logs:</strong> our hosting providers keep standard request logs (IP address, time, page requested, browser type) for security
          and troubleshooting.
        </li>
      </ul>
    ),
  },
  {
    id: "why",
    heading: "Why we use it",
    body: (
      <ul>
        <li>To provide the service you signed up for: run audits and checks, store your history and send in-app alerts.</li>
        <li>To bill you, apply your plan&rsquo;s limits and credits, and keep the records that payment and tax rules require.</li>
        <li>To keep the service secure and fair: prevent abuse, limit free previews and investigate problems.</li>
        <li>To answer you when you contact us.</li>
      </ul>
    ),
  },
  {
    id: "consent",
    heading: "Legal basis",
    body: (
      <p>
        We process account, website and billing data because you asked us to provide the service, which you consent to when you create an account. Security
        logs and abuse limits rely on our legitimate use of data to keep the service safe, as permitted under India&rsquo;s Digital Personal Data Protection
        Act, 2023. You can withdraw consent at any time by deleting your account (see &ldquo;Your rights&rdquo;).
      </p>
    ),
  },
  {
    id: "share",
    heading: "Who processes your data",
    body: (
      <>
        <p>We don&rsquo;t sell personal data or share it for advertising. We use these service providers, only for the purposes above:</p>
        <ul>
          <li>
            <strong>Vercel</strong> hosts the website, and <strong>Render</strong> hosts our API (servers in the United States).
          </li>
          <li>
            <strong>Neon</strong> hosts our database (United States).
          </li>
          <li>
            <strong>Razorpay</strong> processes payments (India).
          </li>
          <li>
            <strong>Google PageSpeed Insights</strong> receives the public URLs being audited, to measure speed.
          </li>
          <li>
            <strong>PostHog</strong> (United States) receives product usage events, such as pages viewed and features used, with your account email and
            name once you sign in, so we can see how Rankwise is used and fix errors.
          </li>
          <li>
            <strong>Google Sheets</strong> receives a copy of feedback you send us, including your name and email if you choose to give them.
          </li>
          <li>
            When enabled, <strong>Resend</strong> sends account emails (password resets and email verification) to your email address.
          </li>
          <li>
            When enabled, <strong>OpenRouter</strong> (AI models) receives public page content for AI rewrite suggestions, and <strong>DataForSEO</strong>{" "}
            receives a domain name for traffic estimates.
          </li>
        </ul>
        <p>Because some providers are outside India, your data may be processed in other countries, under their security and contractual safeguards.</p>
      </>
    ),
  },
  {
    id: "keep",
    heading: "How long we keep it",
    body: (
      <ul>
        <li>Account, website and audit data: while your account is open. Deleting a website deletes its audits, issues and alerts.</li>
        <li>
          When you delete your account (Billing &rarr; Delete account): your account, websites, reports, credits and billing history are removed from {COMPANY.name}{" "}
          straight away. Razorpay keeps its own payment records as payment and tax rules require, and backups roll off within 30 days.
        </li>
        <li>Preview limits: hashed IP counts are only needed for the day they apply to.</li>
      </ul>
    ),
  },
  {
    id: "rights",
    heading: "Your rights",
    body: (
      <>
        <p>
          You can ask to access, correct or delete your personal data, withdraw consent, or nominate someone to act for you. Write to <MailLink subject="Privacy request" />{" "}
          from your account email; we reply within 30 days. You can delete individual websites from their settings, and your whole account from Billing.
        </p>
        <p>
          <strong>Grievance contact:</strong> {COMPANY.name}, {COMPANY.city}, {COMPANY.region}, {COMPANY.country}, <MailLink subject="Grievance" />. If you&rsquo;re
          not satisfied with our answer, you can complain to the Data Protection Board of India.
        </p>
      </>
    ),
  },
  {
    id: "security",
    heading: "Security",
    body: (
      <p>
        Traffic is encrypted with HTTPS, passwords are hashed, sign-in sessions are checked on every request, and each account can only see its own websites
        and reports. No system is perfectly secure; if a breach affects your data, we&rsquo;ll tell you and the authorities as the law requires.
      </p>
    ),
  },
  {
    id: "cookies",
    heading: "Cookies",
    body: (
      <p>
        We use one strictly necessary sign-in cookie and no tracking or advertising cookies. The <Link href="/cookies" className="text-ink underline underline-offset-4">cookie policy</Link>{" "}
        lists everything stored in your browser.
      </p>
    ),
  },
  {
    id: "children",
    heading: "Children",
    body: <p>{COMPANY.name} is a business tool and isn&rsquo;t meant for anyone under 18. We don&rsquo;t knowingly collect children&rsquo;s data.</p>,
  },
  {
    id: "changes",
    heading: "Changes to this policy",
    body: <p>If we change this policy in a way that matters, we&rsquo;ll update the date above and tell signed-in users before the change applies.</p>,
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      label="Privacy"
      title="Privacy policy"
      current="/privacy"
      intro={<p>This policy explains what personal data {COMPANY.name} collects when you use the website and the app, why, and what you can do about it.</p>}
      sections={SECTIONS}
    />
  );
}
