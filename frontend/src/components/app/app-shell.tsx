"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { Activity, CircleAlert, CreditCard, LayoutGrid, LogOut, Menu, Plus, Settings, Unlink, X } from "lucide-react";
import { AlertsBell } from "./monitoring";
import { Logo } from "@/components/site-header";
import { apiFetch } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import type { Site, User } from "@/lib/types";

type Workspace = { user: User | null; sites: Site[] | null; reload: () => Promise<void> };
const WorkspaceContext = createContext<Workspace>({ user: null, sites: null, reload: async () => {} });

export const useWorkspace = () => useContext(WorkspaceContext);

/** Tabs for the selected site. Later phases append Traffic, Search, Audits, AI visibility and Competitors. */
const SITE_NAV = [
  { href: "", label: "Overview", icon: LayoutGrid },
  { href: "/monitoring", label: "Monitoring", icon: Activity },
  { href: "/issues", label: "Issues", icon: CircleAlert },
  { href: "/links", label: "Broken links", icon: Unlink },
  { href: "/settings", label: "Settings", icon: Settings },
];

function SiteMark({ site }: { site: Site }) {
  return (
    <span aria-hidden="true" className="grid size-5 shrink-0 place-items-center rounded-[5px] bg-white/[0.08] font-sub text-[10px] font-medium uppercase text-ink-2">
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

  const item = "flex h-8 items-center gap-2.5 rounded-md px-2 font-sub text-[13.5px] transition-colors duration-150";

  return (
    <nav aria-label="Workspace" className="flex h-full flex-col gap-6 p-3">
      <Link href="/app" onClick={onNavigate} className="flex h-8 items-center rounded-md px-2">
        <Logo />
      </Link>

      <div>
        <p className="px-2 font-sub text-[12px] text-ink-3">Sites</p>
        <ul className="mt-1.5 space-y-0.5">
          {sites === null && [0, 1].map((i) => <li key={i} className="mx-2 my-2 h-4 animate-pulse rounded bg-white/[0.05]" />)}
          {sites?.map((s) => (
            <li key={s.id}>
              <Link
                href={`/app/${s.id}`}
                onClick={onNavigate}
                aria-current={active?.id === s.id ? "true" : undefined}
                className={`${item} ${active?.id === s.id ? "bg-white/[0.06] text-ink" : "text-ink-2 hover:bg-white/[0.04] hover:text-ink"}`}
              >
                <SiteMark site={s} />
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
          <p className="truncate px-2 font-sub text-[12px] text-ink-3">{active.domain}</p>
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
                    className={`${item} ${current ? "bg-white/[0.06] text-ink" : "text-ink-2 hover:bg-white/[0.04] hover:text-ink"}`}
                  >
                    <n.icon aria-hidden="true" className="size-4 text-ink-3" /> {n.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="mt-auto border-t border-line pt-3">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate px-2 font-sub text-[13px] text-ink-2">{user?.name || user?.email || " "}</p>
          <AlertsBell />
        </div>
        {user?.name && <p className="truncate px-2 font-sub text-[12px] text-ink-3">{user.email}</p>}
        <Link
          href="/app/billing"
          onClick={onNavigate}
          aria-current={pathname === "/app/billing" ? "page" : undefined}
          className={`${item} mt-2 ${pathname === "/app/billing" ? "bg-white/[0.06] text-ink" : "text-ink-3 hover:bg-white/[0.04] hover:text-ink"}`}
        >
          <CreditCard aria-hidden="true" className="size-4" /> Billing
        </Link>
        <button type="button" onClick={logout} className={`${item} w-full cursor-pointer text-ink-3 hover:bg-white/[0.04] hover:text-ink`}>
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
        <aside className="sticky top-0 hidden h-dvh w-[240px] shrink-0 border-r border-line bg-surface-ink lg:block">
          <Sidebar user={user} sites={sites} onNavigate={() => {}} />
        </aside>

        {/* mobile drawer */}
        {open && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
            <aside className="relative h-full w-[260px] border-r border-line bg-surface-ink">
              <Sidebar user={user} sites={sites} onNavigate={() => setOpen(false)} />
            </aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-12 items-center border-b border-line px-4 lg:hidden">
            <button type="button" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((o) => !o)} className="-ml-2 grid size-10 cursor-pointer place-items-center rounded-md text-ink-2">
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
