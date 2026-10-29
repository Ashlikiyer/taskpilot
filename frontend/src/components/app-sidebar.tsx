"use client";

import {
  ChevronsUpDownIcon,
  CircleCheckIcon,
  LayoutDashboardIcon,
  PlusIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { CommandMenu } from "@/components/command-menu";
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
import { UserMenu } from "@/components/user-menu";
import { useProjects } from "@/hooks/use-projects";
import type { Schemas } from "@/lib/api/client";
import { hasRole, ROLE_LABELS } from "@/lib/roles";
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
    // Viewers can't be assigned tasks, so they have no My Tasks page.
    ...(workspace.role === "viewer"
      ? []
      : [
          {
            href: `${base}/my-tasks`,
            label: "My Tasks",
            icon: CircleCheckIcon,
          },
        ]),
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

      <CommandMenu workspace={workspace} />

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

      <SidebarProjects workspace={workspace} pathname={pathname} />

      <div className="md:mt-auto">
        <UserMenu />
      </div>
    </aside>
  );
}

function SidebarProjects({
  workspace,
  pathname,
}: {
  workspace: Workspace;
  pathname: string;
}) {
  const projects = useProjects(workspace.id);
  const [creating, setCreating] = useState(false);
  const canCreate = hasRole(workspace.role, "admin");

  return (
    <section aria-labelledby="sidebar-projects" className="grid gap-1">
      <div className="flex items-center justify-between px-2">
        <h2
          id="sidebar-projects"
          className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
        >
          Projects
        </h2>
        {canCreate && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="New project"
            title="New project"
            onClick={() => setCreating(true)}
          >
            <PlusIcon />
          </Button>
        )}
      </div>

      {projects.isPending && <Skeleton className="mx-2 h-6" />}
      {projects.isError && (
        <p className="px-2 text-sm text-muted-foreground">
          Couldn&apos;t load projects.{" "}
          <button className="underline" onClick={() => projects.refetch()}>
            Retry
          </button>
        </p>
      )}
      {projects.data?.length === 0 && (
        <p className="px-2 text-sm text-muted-foreground">No projects yet.</p>
      )}
      {projects.data && projects.data.length > 0 && (
        <ul className="flex gap-1 overflow-x-auto md:grid md:overflow-visible">
          {projects.data.map((project) => {
            const href = `/w/${workspace.slug}/p/${project.id}`;
            const active = pathname.startsWith(href);
            return (
              <li key={project.id} className="shrink-0">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted",
                    active && "bg-muted font-medium",
                  )}
                >
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: project.color }}
                  />
                  <span className="truncate">{project.name}</span>
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
