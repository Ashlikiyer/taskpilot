"use client";

import { CommandMenu } from "@/components/command-menu";
import { NotificationBell } from "@/components/notification-bell";
import { Avatar } from "@/components/task-ui";
import { useMe } from "@/hooks/use-auth";
import type { Schemas } from "@/lib/api/client";

/** Search, notifications and the signed-in user, above every workspace page. */
export function TopBar({
  workspace,
  start,
}: {
  workspace: Schemas["WorkspaceOut"];
  /** Shown on the left (the mobile menu button). */
  start?: React.ReactNode;
}) {
  const me = useMe();
  return (
    <header className="flex h-[60px] shrink-0 items-center gap-3 border-b bg-card px-4 md:px-6">
      {start}
      <div className="w-full max-w-60 md:ml-auto">
        <CommandMenu workspace={workspace} />
      </div>
      <NotificationBell />
      {me.data && (
        <>
          <div aria-hidden className="hidden h-6 w-px bg-border md:block" />
          <div className="hidden items-center gap-2 md:flex">
            <Avatar name={me.data.name} id={me.data.id} size="lg" />
            <div className="grid leading-tight">
              <span className="text-[12.5px] font-semibold">
                {me.data.name}
              </span>
              <span className="text-[11px] text-subtle">{me.data.email}</span>
            </div>
          </div>
        </>
      )}
    </header>
  );
}
