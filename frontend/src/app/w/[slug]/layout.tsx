"use client";

import Link from "next/link";

import { AppSidebar } from "@/components/app-sidebar";
import { NotificationBell } from "@/components/notification-bell";
import { EmptyState, ErrorState } from "@/components/states";
import { TaskDrawer } from "@/components/tasks/task-drawer";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentWorkspace } from "@/hooks/use-workspaces";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { workspace, data, isPending, isError, refetch } =
    useCurrentWorkspace();

  if (isPending) {
    return (
      <div className="flex flex-1 items-center justify-center p-8" aria-busy>
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }
  if (isError) {
    return (
      <ErrorState
        message="We couldn't load this workspace."
        onRetry={() => refetch()}
      />
    );
  }
  if (!workspace) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-16">
        <EmptyState
          title="Workspace not found"
          description="It may have been deleted, or you're no longer a member."
          action={
            <Link href="/w" className={buttonVariants()}>
              Back to your workspaces
            </Link>
          }
        />
      </main>
    );
  }

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <AppSidebar workspace={workspace} workspaces={data} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 items-center justify-end border-b px-4 md:px-8">
          <NotificationBell />
        </header>
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
      <TaskDrawer workspace={workspace} />
    </div>
  );
}
