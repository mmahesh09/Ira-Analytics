import Link from "next/link";
import { Logo } from "@/components/site-header";
import { AuthShowcase } from "@/components/auth-showcase";

/** Split layout: form on the left (focal point), product context on the right (desktop only). */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.15fr_1fr]">
      <div className="flex min-h-dvh flex-col px-6 sm:px-10 lg:px-16">
        <header className="flex h-16 items-center">
          <Link href="/" aria-label="Rankwise home" className="rounded-md">
            <Logo />
          </Link>
        </header>
        <main id="main" className="flex flex-1 items-center py-12">
          <div className="mx-auto w-full max-w-[400px]">{children}</div>
        </main>
        <footer className="flex h-16 items-center justify-between font-sub text-[12.5px] text-ink-3">
          <span>© Rankwise</span>
          <Link href="/" className="hover:text-ink">
            Back to site
          </Link>
        </footer>
      </div>
      <aside className="hidden lg:block">
        <AuthShowcase />
      </aside>
    </div>
  );
}
