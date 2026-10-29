"use client";

import Link from "next/link";

import { EmptyState, ErrorState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { UserMenu } from "@/components/user-menu";
import { CreateWorkspaceDialog } from "@/components/workspaces/create-workspace-dialog";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { ROLE_LABELS } from "@/lib/roles";

export default function WorkspacePickerPage() {
  const workspaces = useWorkspaces();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Your workspaces
          </h1>
          <p className="text-sm text-muted-foreground">
            Pick a workspace or create a new one.
          </p>
        </div>
        {workspaces.data && workspaces.data.length > 0 && (
          <CreateWorkspaceDialog />
        )}
      </header>

      {workspaces.isPending && (
        <div className="grid gap-3" aria-busy>
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      )}

      {workspaces.isError && (
        <ErrorState
          message="We couldn't load your workspaces."
          onRetry={() => workspaces.refetch()}
        />
      )}

      {workspaces.data?.length === 0 && (
        <EmptyState
          title="You're not in any workspace yet"
          description="Create one for your team, or ask an admin to send you an invite link."
          action={<CreateWorkspaceDialog />}
        />
      )}

      {workspaces.data && workspaces.data.length > 0 && (
        <ul className="grid gap-3">
          {workspaces.data.map((workspace) => (
            <li key={workspace.id}>
              <Link
                href={`/w/${workspace.slug}`}
                className="flex items-center gap-3 rounded-xl border p-4 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary font-semibold text-primary-foreground">
                  {workspace.name.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">
                  {workspace.name}
                </span>
                <Badge variant="secondary">{ROLE_LABELS[workspace.role]}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <footer className="mt-auto border-t pt-4">
        <UserMenu />
      </footer>
    </main>
  );
}
