"use client";

import {
  ChevronDownIcon,
  CircleCheckIcon,
  FileSpreadsheetIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  PlusIcon,
  SettingsIcon,
  SunriseIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { useCreateWithAI } from "@/components/ai/create-with-ai";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useAIUsage } from "@/hooks/use-ai";
import { useLogout } from "@/hooks/use-auth";
import { useProjects } from "@/hooks/use-projects";
import { useMyTasks } from "@/hooks/use-tasks";
import type { Schemas } from "@/lib/api/client";
import { hasRole, ROLE_LABELS } from "@/lib/roles";
import { cn } from "@/lib/utils";

type Workspace = Schemas["WorkspaceOut"];

export type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
};

/** The workspace's main pages, filtered by role. Shared with the mobile menu. */
export function useWorkspaceNav(workspace: Workspace): NavItem[] {
  const base = `/w/${workspace.slug}`;
  const isViewer = workspace.role === "viewer";
  const myTasks = useMyTasks(isViewer ? undefined : workspace.id);
  const openMine = myTasks.data
    ? myTasks.data.overdue.length +
      myTasks.data.due_today.length +
      myTasks.data.this_week.length +
      myTasks.data.later.length +
      myTasks.data.no_date.length
    : undefined;

  return [
    { href: base, label: "Dashboard", icon: LayoutDashboardIcon },
    // Viewers can't be assigned tasks, so they have no My Tasks or Digest page.
    ...(isViewer
      ? []
      : [
          {
            href: `${base}/my-tasks`,
            label: "My Tasks",
            icon: CircleCheckIcon,
            count: openMine,
          },
          { href: `${base}/digest`, label: "Daily digest", icon: SunriseIcon },
        ]),
    ...(hasRole(workspace.role, "admin")
      ? [{ href: `${base}/import`, label: "Import", icon: FileSpreadsheetIcon }]
      : []),
    { href: `${base}/settings/members`, label: "Members", icon: UsersIcon },
  ];
}

export function AppSidebar({
  workspace,
  workspaces,
  className,
  onNavigate,
}: {
  workspace: Workspace;
  workspaces: Workspace[];
  className?: string;
  /** Called after a link is followed (closes the mobile menu). */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const nav = useWorkspaceNav(workspace);
  const createWithAI = useCreateWithAI();

  return (
    <aside
      className={cn(
        "flex w-58 shrink-0 flex-col gap-4 border-r border-sidebar-border bg-sidebar px-3 py-3.5 text-sidebar-foreground",
        className,
      )}
    >
      <WorkspaceSwitcher workspace={workspace} workspaces={workspaces} />

      {createWithAI.available && (
        <Button
          variant="ai-soft"
          className="h-9 w-full justify-start gap-2 border px-2.5 font-medium"
          onClick={() => {
            onNavigate?.();
            createWithAI.open();
          }}
          aria-keyshortcuts="Control+J Meta+J"
        >
          <span aria-hidden>✦</span>
          <span className="flex-1 text-left">Create with AI</span>
          <kbd className="rounded border border-ai-border bg-card px-1.5 font-mono text-[10.5px]">
            Ctrl J
          </kbd>
        </Button>
      )}

      <nav aria-label="Workspace" className="grid gap-0.5">
        <p className="px-2.5 pb-1 text-[11px] text-subtle">Main menu</p>
        {nav.map(({ href, label, icon: Icon, count }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] hover:bg-muted",
                active &&
                  "bg-sidebar-accent font-semibold text-sidebar-accent-foreground hover:bg-sidebar-accent",
              )}
            >
              <Icon
                className={cn(
                  "size-4",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              />
              <span className="flex-1">{label}</span>
              {count !== undefined && count > 0 && (
                <span className="rounded-full bg-accent px-1.5 font-mono text-[10.5px] text-muted-foreground">
                  {count}
                  <span className="sr-only"> open</span>
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <SidebarProjects
        workspace={workspace}
        pathname={pathname}
        onNavigate={onNavigate}
      />

      <div className="mt-auto grid gap-3">
        {createWithAI.available && <AIUsageCard />}
        <div className="grid gap-0.5 text-[13px]">
          {hasRole(workspace.role, "admin") && (
            <Link
              href={`/w/${workspace.slug}/settings`}
              onClick={onNavigate}
              aria-current={
                pathname === `/w/${workspace.slug}/settings`
                  ? "page"
                  : undefined
              }
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 hover:bg-muted",
                pathname === `/w/${workspace.slug}/settings` &&
                  "bg-sidebar-accent font-semibold text-sidebar-accent-foreground",
              )}
            >
              <SettingsIcon className="size-4 text-muted-foreground" />
              Settings
            </Link>
          )}
          <LogOutButton />
        </div>
      </div>
    </aside>
  );
}

function WorkspaceSwitcher({
  workspace,
  workspaces,
}: {
  workspace: Workspace;
  workspaces: Workspace[];
}) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex w-full items-center gap-2.5 rounded-lg p-1 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-label={`Workspace: ${workspace.name}. Switch workspace`}
      >
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-primary text-sm text-primary-foreground"
        >
          ✦
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] text-subtle">
            {ROLE_LABELS[workspace.role]} · Workspace
          </span>
          <span className="block truncate text-[13.5px] font-semibold text-foreground">
            {workspace.name}
          </span>
        </span>
        <span className="flex size-5.5 items-center justify-center rounded-md border border-sidebar-border text-subtle">
          <ChevronDownIcon className="size-3" />
        </span>
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
  );
}

function AIUsageCard() {
  const usage = useAIUsage();
  if (!usage.data) return null;
  const { used, limit } = usage.data;
  const percent = Math.min(100, Math.round((used / limit) * 100));
  return (
    <div className="grid gap-2 rounded-xl border border-sidebar-border bg-[#fafaf8] p-3">
      <p className="flex items-center gap-2 text-[12.5px] font-semibold text-foreground">
        <span
          aria-hidden
          className="flex size-6 items-center justify-center rounded-[7px] bg-ai-soft text-xs text-ai"
        >
          ✦
        </span>
        AI usage today
      </p>
      <div
        role="meter"
        aria-label="AI calls used today"
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={used}
        className="h-1.5 overflow-hidden rounded-full bg-[#ece9f8]"
      >
        <div className="h-full bg-ai" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-[11.5px] text-muted-foreground">
        {used} of {limit} calls · resets at midnight
      </p>
    </div>
  );
}

function LogOutButton() {
  const router = useRouter();
  const logout = useLogout();
  return (
    <button
      type="button"
      disabled={logout.isPending}
      onClick={() =>
        logout.mutate(undefined, {
          onSettled: () => router.replace("/login"),
        })
      }
      className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[#c2453b] hover:bg-destructive/5 disabled:opacity-50"
    >
      <LogOutIcon className="size-4" />
      Log out
    </button>
  );
}

function SidebarProjects({
  workspace,
  pathname,
  onNavigate,
}: {
  workspace: Workspace;
  pathname: string;
  onNavigate?: () => void;
}) {
  const projects = useProjects(workspace.id);
  const [creating, setCreating] = useState(false);
  const canCreate = hasRole(workspace.role, "admin");

  return (
    <section aria-labelledby="sidebar-projects" className="grid gap-0.5">
      <div className="flex items-center justify-between pr-1 pl-2.5">
        <h2 id="sidebar-projects" className="text-[11px] text-subtle">
          Projects
        </h2>
        {canCreate && (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="New project"
            title="New project"
            onClick={() => setCreating(true)}
          >
            <PlusIcon />
          </Button>
        )}
      </div>

      {projects.isPending && <Skeleton className="mx-2.5 h-6" />}
      {projects.isError && (
        <p className="px-2.5 text-sm text-muted-foreground">
          Couldn&apos;t load projects.{" "}
          <button className="underline" onClick={() => projects.refetch()}>
            Retry
          </button>
        </p>
      )}
      {projects.data?.length === 0 && (
        <p className="px-2.5 text-[13px] text-muted-foreground">
          No projects yet.
        </p>
      )}
      {projects.data && projects.data.length > 0 && (
        <ul className="grid gap-0.5">
          {projects.data.map((project) => {
            const href = `/w/${workspace.slug}/p/${project.id}`;
            const active = pathname.startsWith(href);
            return (
              <li key={project.id}>
                <Link
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] hover:bg-muted",
                    active &&
                      "bg-sidebar-accent font-semibold text-sidebar-accent-foreground hover:bg-sidebar-accent",
                  )}
                >
                  <span
                    aria-hidden
                    className="h-[11px] w-3.5 shrink-0 rounded-[2px_3px_3px_3px]"
                    style={{ backgroundColor: project.color }}
                  />
                  <span className="flex-1 truncate">{project.name}</span>
                  {canCreate && project.intake_pending > 0 && (
                    <span
                      className="rounded-full bg-ai-soft px-1.5 font-mono text-[10.5px] text-ai"
                      title={`${project.intake_pending} pending in the Inbox`}
                    >
                      {project.intake_pending}
                      <span className="sr-only"> pending in the Inbox</span>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {canCreate && (
        <ProjectFormDialog
          workspace={workspace}
          open={creating}
          onOpenChange={setCreating}
        />
      )}
    </section>
  );
}
