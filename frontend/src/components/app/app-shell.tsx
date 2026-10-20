"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { Activity, CircleAlert, CreditCard, LayoutGrid, LogOut, Menu, Plus, Settings, ShieldCheck, Unlink, X } from "lucide-react";
import { AlertsBell } from "./monitoring";
import { WorkspaceContext } from "./workspace";
import { Logo } from "@/components/site-header";
import { apiFetch } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import type { Site, User } from "@/lib/types";

/** Tabs for the selected site. Later phases append Traffic, Search, Audits, AI visibility and Competitors. */
const SITE_NAV = [
  { href: "", label: "Overview", icon: LayoutGrid },
  { href: "/monitoring", label: "Monitoring", icon: Activity },
  { href: "/issues", label: "Issues", icon: CircleAlert },
  { href: "/links", label: "Broken links", icon: Unlink },
  { href: "/settings", label: "Settings", icon: Settings },
];

function SiteMark({ site, active }: { site: Site; active?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`grid size-5 shrink-0 place-items-center rounded-[5px] font-sub text-[10px] font-medium uppercase ${active ? "bg-cobalt-fill text-white" : "bg-white/[0.08] text-ink-2"}`}
    >
      {site.domain[0]}
    </span>
  );
}

function Sidebar({ user, sites, onNavigate }: { user: User | null; sites: Site[] | null; onNavigate: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { siteId } = useParams<{ siteId?: string }>();
  const active = sites?.find((s) => String(s.id) === siteId);

  async function logout() {
    await authClient.signOut().catch(() => {});
    router.replace("/login");
    router.refresh();
  }

  const item = "relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 font-sub text-[13.5px] transition-colors duration-150";
  // current page: purple tint with a short accent bar on the left edge
  const on = "bg-cobalt-soft text-ink before:absolute before:inset-y-2 before:-left-3 before:w-[3px] before:rounded-r before:bg-cobalt";
  const off = "text-ink-2 hover:bg-white/[0.04] hover:text-ink";

  return (
    <nav aria-label="Workspace" className="flex h-full flex-col gap-7 p-3">
      <Link href="/app" onClick={onNavigate} className="flex h-10 items-center rounded-md px-2.5">
        <Logo />
      </Link>

      <div>
        <p className="eyebrow px-2.5 text-[10.5px]">Sites</p>
        <ul className="mt-1.5 space-y-0.5">
          {sites === null && [0, 1].map((i) => <li key={i} className="mx-2 my-2 h-4 animate-pulse rounded bg-white/[0.05]" />)}
          {sites?.map((s) => (
            <li key={s.id}>
              <Link
                href={`/app/${s.id}`}
                onClick={onNavigate}
                aria-current={active?.id === s.id ? "true" : undefined}
                className={`${item} ${active?.id === s.id ? "bg-white/[0.05] text-ink" : off}`}
              >
                <SiteMark site={s} active={active?.id === s.id} />
                <span className="truncate">{s.name}</span>
              </Link>
            </li>
          ))}
          <li>
            <Link href="/app?add=1" onClick={onNavigate} className={`${item} text-ink-3 hover:bg-white/[0.04] hover:text-ink`}>
              <Plus aria-hidden="true" className="size-4" /> Add site
            </Link>
          </li>
        </ul>
      </div>

      {active && (
        <div>
          <p className="eyebrow truncate px-2.5 text-[10.5px] normal-case tracking-[0.06em]">{active.domain}</p>
          <ul className="mt-1.5 space-y-0.5">
            {SITE_NAV.map((n) => {
              const href = `/app/${active.id}${n.href}`;
              const current = pathname === href;
              return (
                <li key={n.label}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={current ? "page" : undefined}
                    className={`${item} ${current ? on : off}`}
                  >
                    <n.icon aria-hidden="true" className={`size-4 ${current ? "text-cobalt" : "text-ink-3"}`} /> {n.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="mt-auto border-t border-line pt-3">
        <div className="flex items-center gap-2.5 px-1.5">
          <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-cobalt-fill font-sub text-[13px] font-medium uppercase text-white">
            {(user?.name || user?.email || "?")[0]}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-sub text-[13px] text-ink">{user?.name || user?.email || " "}</span>
            {user?.name && <span className="block truncate font-sub text-[11.5px] text-ink-3">{user.email}</span>}
          </span>
          <AlertsBell />
        </div>
        <Link
          href="/app/billing"
          onClick={onNavigate}
          aria-current={pathname === "/app/billing" ? "page" : undefined}
          className={`${item} mt-3 ${pathname === "/app/billing" ? on : off}`}
        >
          <CreditCard aria-hidden="true" className="size-4" /> Billing
        </Link>
        <Link
          href="/app/account"
          onClick={onNavigate}
          aria-current={pathname === "/app/account" ? "page" : undefined}
          className={`${item} ${pathname === "/app/account" ? on : off}`}
        >
          <ShieldCheck aria-hidden="true" className="size-4" /> Account &amp; security
        </Link>
        <button type="button" onClick={logout} className={`${item} w-full cursor-pointer ${off}`}>
          <LogOut aria-hidden="true" className="size-4" /> Log out
        </button>
      </div>
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [sites, setSites] = useState<Site[] | null>(null);
  const [open, setOpen] = useState(false);

  const reload = useCallback(async () => {
    const [me, list] = await Promise.all([apiFetch<User>("/me"), apiFetch<Site[]>("/sites")]);
    setUser(me);
    setSites(list);
  }, []);

  useEffect(() => {
    let live = true;
    Promise.all([apiFetch<User>("/me"), apiFetch<Site[]>("/sites")])
      .then(([me, list]) => {
        if (!live) return;
        setUser(me);
        setSites(list);
      })
      .catch(() => live && setSites([]));
    return () => {
      live = false;
    };
  }, []);

  return (
    <WorkspaceContext.Provider value={{ user, sites, reload }}>
      <div className="flex min-h-dvh">
        <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 border-r border-line bg-[#0b0b0e] lg:block">
          <Sidebar user={user} sites={sites} onNavigate={() => {}} />
        </aside>

        {/* mobile drawer */}
        {open && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
            <aside className="relative h-full w-[264px] border-r border-line bg-[#0b0b0e]">
              <Sidebar user={user} sites={sites} onNavigate={() => setOpen(false)} />
            </aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-paper/[0.85] px-4 backdrop-blur-xl lg:hidden">
            <Link href="/app" aria-label="Rankwise home">
              <Logo />
            </Link>
            <button type="button" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((o) => !o)} className="-mr-2 grid size-11 cursor-pointer place-items-center rounded-full text-ink-2 hover:bg-white/[0.05]">
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
          <main id="main" className="flex-1">
            {children}
          </main>
        </div>
      </div>
    </WorkspaceContext.Provider>
  );
}
