"use client";

import { MenuIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { CreateWithAIProvider } from "@/components/ai/create-with-ai";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import { EmptyState, ErrorState } from "@/components/states";
import { TaskDrawer } from "@/components/tasks/task-drawer";
import { TopBar } from "@/components/top-bar";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentWorkspace } from "@/hooks/use-workspaces";
import type { Schemas } from "@/lib/api/client";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { workspace, data, isPending, isError, refetch } =
    useCurrentWorkspace();
  const [menuOpen, setMenuOpen] = useState(false);

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
    <CreateWithAIProvider workspace={workspace}>
      <div className="flex min-h-svh flex-1">
        <AppSidebar
          workspace={workspace}
          workspaces={data}
          className="sticky top-0 hidden h-svh overflow-y-auto md:flex"
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar
            workspace={workspace}
            start={
              <MobileMenu
                workspace={workspace}
                workspaces={data}
                open={menuOpen}
                onOpenChange={setMenuOpen}
              />
            }
          />
          {/* Bottom padding keeps content clear of the phone tab bar. */}
          <main className="min-w-0 flex-1 px-4 pt-5 pb-24 md:px-8 md:py-7">
            {children}
          </main>
        </div>
      </div>
      <MobileTabBar
        workspace={workspace}
        onOpenMenu={() => setMenuOpen(true)}
      />
      <TaskDrawer workspace={workspace} />
    </CreateWithAIProvider>
  );
}

/** Below the md breakpoint the sidebar opens from a menu button. */
function MobileMenu({
  workspace,
  workspaces,
  open,
  onOpenChange: setOpen,
}: {
  workspace: Schemas["WorkspaceOut"];
  workspaces: Schemas["WorkspaceOut"][];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label="Open menu"
        onClick={() => setOpen(true)}
      >
        <MenuIcon />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="w-58 gap-0 p-0"
          showCloseButton={false}
        >
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SheetDescription className="sr-only">
            Workspace pages and projects
          </SheetDescription>
          <AppSidebar
            workspace={workspace}
            workspaces={workspaces}
            className="h-full overflow-y-auto border-r-0"
            onNavigate={() => setOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
