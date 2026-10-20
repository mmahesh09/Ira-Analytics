"use client";

import { createContext, useContext, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Loader from "@/components/kokonutui/loader";
import type { Site, User } from "@/lib/types";

/** Shared by the app shell and every site page; kept apart so those modules don't import each other. */
type Workspace = { user: User | null; sites: Site[] | null; reload: () => Promise<void> };
export const WorkspaceContext = createContext<Workspace>({ user: null, sites: null, reload: async () => {} });

export const useWorkspace = () => useContext(WorkspaceContext);

export function useSite(): Site | null | undefined {
  const { siteId } = useParams<{ siteId: string }>();
  const { sites } = useWorkspace();
  if (sites === null) return undefined; // loading
  return sites.find((s) => String(s.id) === siteId) ?? null;
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: string; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: string }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line px-6 pb-6 pt-8 lg:px-10">
      <div className="min-w-0">
        {eyebrow && (
          <p className="eyebrow mb-3 flex items-center gap-2 text-[11px]">
            <span className="size-1.5 rounded-full bg-cobalt shadow-[0_0_8px_var(--cobalt)]" /> {eyebrow}
          </p>
        )}
        <h1 className="truncate text-[30px] font-semibold tracking-[-0.03em]">{title}</h1>
        {subtitle && <p className="mt-1 font-sub text-[14px] text-ink-3">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </header>
  );
}

export function Loading({ title = "Loading your workspace", subtitle = "" }: { title?: string; subtitle?: string }) {
  return <Loader size="sm" title={title} subtitle={subtitle} className="min-h-[50vh]" />;
}

export function NotFound() {
  return (
    <div className="px-6 py-24 text-center lg:px-10">
      <p className="text-[18px] font-medium">Site not found</p>
      <Link href="/app" className="mt-3 inline-block font-sub text-[14px] text-ink-3 hover:text-ink">
        Back to sites
      </Link>
    </div>
  );
}
