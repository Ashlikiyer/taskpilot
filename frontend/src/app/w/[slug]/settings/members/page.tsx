"use client";

import { InviteDialog } from "@/components/members/invite-dialog";
import { MemberTable } from "@/components/members/member-table";
import { EmptyState, ErrorState } from "@/components/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/hooks/use-auth";
import { useCurrentWorkspace, useMembers } from "@/hooks/use-workspaces";
import { hasRole } from "@/lib/roles";

export default function MembersPage() {
  const { workspace } = useCurrentWorkspace();
  const me = useMe();
  const members = useMembers(workspace?.id);
  if (!workspace) return null;

  const canManage = hasRole(workspace.role, "admin");

  return (
    <div className="grid max-w-4xl gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Members</h1>
          <p className="text-sm text-muted-foreground">
            {canManage
              ? "Invite people and manage their roles."
              : "People who have access to this workspace."}
          </p>
        </div>
        {canManage && <InviteDialog workspaceId={workspace.id} />}
      </header>

      {members.isPending && (
        <div className="grid gap-2" aria-busy>
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      )}
      {members.isError && (
        <ErrorState
          message="We couldn't load members."
          onRetry={() => members.refetch()}
        />
      )}
      {members.data?.length === 0 && (
        <EmptyState
          title="No members"
          description="Invite someone to get started."
        />
      )}
      {members.data && members.data.length > 0 && (
        <MemberTable
          workspaceId={workspace.id}
          members={members.data}
          canManage={canManage}
          currentUserId={me.data?.id}
        />
      )}
    </div>
  );
}
