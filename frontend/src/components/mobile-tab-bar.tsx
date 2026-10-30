"use client";

import {
  CircleCheckIcon,
  LayoutDashboardIcon,
  MenuIcon,
  SunriseIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useCreateWithAI } from "@/components/ai/create-with-ai";
import type { Schemas } from "@/lib/api/client";
import { cn } from "@/lib/utils";

/** Phones: the main pages at the bottom, with Create with AI in the middle. */
export function MobileTabBar({
  workspace,
  onOpenMenu,
}: {
  workspace: Schemas["WorkspaceOut"];
  onOpenMenu: () => void;
}) {
  const pathname = usePathname();
  const createWithAI = useCreateWithAI();
  const base = `/w/${workspace.slug}`;
  const isViewer = workspace.role === "viewer";
  const left = [{ href: base, label: "Home", icon: LayoutDashboardIcon }];
  const right = isViewer
    ? [{ href: `${base}/settings/members`, label: "Members", icon: UsersIcon }]
    : [{ href: `${base}/digest`, label: "Digest", icon: SunriseIcon }];
  if (!isViewer)
    left.push({
      href: `${base}/my-tasks`,
      label: "My Tasks",
      icon: CircleCheckIcon,
    });

  const tab = ({ href, label, icon: Icon }: (typeof left)[number]) => {
    const active = pathname === href;
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-w-14 flex-col items-center gap-0.5 text-[11px] text-[#77777c]",
          active && "font-semibold text-foreground",
        )}
      >
        <Icon className="size-5" />
        {label}
      </Link>
    );
  };

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-around border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {left.map(tab)}
      {createWithAI.available && (
        <button
          type="button"
          onClick={createWithAI.open}
          aria-label="Create with AI"
          className="flex size-11 items-center justify-center rounded-full bg-ai text-lg text-ai-foreground shadow-[0_4px_12px_rgba(104,71,224,.35)] focus-visible:ring-3 focus-visible:ring-ai/40 focus-visible:outline-none"
        >
          <span aria-hidden>✦</span>
        </button>
      )}
      {right.map(tab)}
      <button
        type="button"
        onClick={onOpenMenu}
        className="flex min-w-14 flex-col items-center gap-0.5 text-[11px] text-[#77777c]"
      >
        <MenuIcon className="size-5" />
        Menu
      </button>
    </nav>
  );
}
