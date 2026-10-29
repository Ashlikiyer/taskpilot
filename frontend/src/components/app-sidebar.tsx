"use client";

import {
  ChevronsUpDownIcon,
  LayoutDashboardIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserMenu } from "@/components/user-menu";
import type { Schemas } from "@/lib/api/client";
import { ROLE_LABELS } from "@/lib/roles";
import { cn } from "@/lib/utils";

type Workspace = Schemas["WorkspaceOut"];

export function AppSidebar({
  workspace,
  workspaces,
}: {
  workspace: Workspace;
  workspaces: Workspace[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const base = `/w/${workspace.slug}`;
  const nav = [
    { href: base, label: "Dashboard", icon: LayoutDashboardIcon },
    { href: `${base}/settings/members`, label: "Members", icon: UsersIcon },
  ];

  return (
    <aside className="flex shrink-0 flex-col gap-4 border-b bg-muted/30 p-3 md:min-h-svh md:w-60 md:border-r md:border-b-0">
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex w-full items-center gap-2 rounded-lg p-2 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          aria-label="Switch workspace"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
            {workspace.name.charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {workspace.name}
            </span>
            <span className="block text-xs text-muted-foreground">
              {ROLE_LABELS[workspace.role]}
            </span>
          </span>
          <ChevronsUpDownIcon className="size-4 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
            {workspaces.map((w) => (
              <DropdownMenuItem
                key={w.id}
                onClick={() => router.push(`/w/${w.slug}`)}
              >
                <span className="truncate">{w.name}</span>
                {w.id === workspace.id && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    Current
                  </span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push("/w")}>
            All workspaces / create new
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <nav aria-label="Workspace" className="flex gap-1 md:flex-col">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted",
                active && "bg-muted font-medium",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="md:mt-auto">
        <UserMenu />
      </div>
    </aside>
  );
}
