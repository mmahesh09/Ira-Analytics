"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Activity, CircleAlert, CreditCard, Globe, Inbox, LayoutGrid, MessageSquare, Plus, ScanSearch, Settings, ShieldCheck, Unlink } from "lucide-react";
import ActionSearchBar, { type CommandItem } from "@/components/kokonutui/action-search-bar";
import type { Site, User } from "@/lib/types";

const SITE_PAGES = [
  { path: "", label: "Overview", icon: LayoutGrid },
  { path: "/monitoring", label: "Monitoring", icon: Activity },
  { path: "/issues", label: "Issues", icon: CircleAlert },
  { path: "/links", label: "Broken links", icon: Unlink },
  { path: "/settings", label: "Settings", icon: Settings },
];

const icon = (Icon: typeof Globe) => <Icon aria-hidden="true" className="size-4" />;

/** Ctrl/⌘K: jump to any site page or workspace screen. Built only from data the shell already has. */
export function CommandPalette({ user, sites, onNavigate }: { user: User | null; sites: Site[] | null; onNavigate: () => void }) {
  const router = useRouter();

  const items = useMemo<CommandItem[]>(() => {
    const siteItems: CommandItem[] = (sites ?? []).map((site) => ({
      id: `site-${site.id}`,
      label: site.domain,
      icon: icon(Globe),
      group: "Sites",
      keywords: [site.name],
      placeholder: `Open a page of ${site.domain}…`,
      children: SITE_PAGES.map((page) => ({
        id: `site-${site.id}${page.path || "/overview"}`,
        label: page.label,
        icon: icon(page.icon),
        href: `/app/${site.id}${page.path}`,
        keywords: [site.domain],
      })),
    }));
    const go: CommandItem[] = [
      { id: "add-site", label: "Add a site", icon: icon(Plus), group: "Go to", href: "/app?add=1", keywords: ["new", "domain"] },
      { id: "audit", label: "Audit any URL", icon: icon(ScanSearch), group: "Go to", href: "/audit", keywords: ["check", "scan", "report"] },
      { id: "billing", label: "Billing", icon: icon(CreditCard), group: "Go to", href: "/app/billing", keywords: ["plan", "credits", "receipt", "payment"] },
      { id: "account", label: "Account & security", icon: icon(ShieldCheck), group: "Go to", href: "/app/account", keywords: ["password", "2fa", "sessions"] },
      { id: "feedback", label: "Send feedback", icon: icon(MessageSquare), group: "Go to", href: "/feedback" },
    ];
    if (user?.is_admin) go.push({ id: "admin-feedback", label: "Feedback (admin)", icon: icon(Inbox), group: "Admin", href: "/app/admin/feedback" });
    return [...siteItems, ...go];
  }, [sites, user?.is_admin]);

  return (
    <ActionSearchBar
      items={items}
      defaultRecent={[]}
      shortcut
      label="Search sites and pages"
      placeholder="Search or jump to…"
      className="max-w-none"
      onSelect={(item) => {
        if (!item.href) return;
        onNavigate();
        router.push(item.href);
      }}
    />
  );
}
