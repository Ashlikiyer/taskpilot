"use client";

import Link from "next/link";

import { IntakeItemCard } from "@/components/intake/intake-item-card";
import { EmptyState, ErrorState } from "@/components/states";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useIntakeItems } from "@/hooks/use-intake";
import { useCurrentProject } from "@/hooks/use-projects";
import { useLabels } from "@/hooks/use-tasks";
import { useCurrentWorkspace, useMembers } from "@/hooks/use-workspaces";
import { hasRole } from "@/lib/roles";

export default function InboxPage() {
  const { workspace } = useCurrentWorkspace();
  const project = useCurrentProject();
  const isAdmin = hasRole(workspace?.role, "admin");
  const items = useIntakeItems(
    project.data?.id ?? "",
    isAdmin && Boolean(project.data),
  );
  const members = useMembers(workspace?.id);
  const labels = useLabels(workspace?.id);
  // The project layout handles loading, error and not-found states for the project.
  if (!workspace || !project.data) return null;

  if (!isAdmin) {
    return (
      <EmptyState
        title="Only admins review the Inbox"
        description="Requests from email and the public form wait here until an admin accepts or rejects them."
      />
    );
  }

  const intakeConfigured =
    project.data.intake_email_label !== null ||
    project.data.intake_form_enabled;

  return (
    <div className="grid max-w-3xl gap-4">
      <p className="text-sm text-muted-foreground">
        Requests from email and the public form. The AI drafted each task; check
        it, then accept or reject.
      </p>
      {items.isPending && (
        <div className="grid gap-3" aria-busy>
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      )}
      {items.isError && (
        <ErrorState
          message="We couldn't load the Inbox."
          onRetry={() => items.refetch()}
        />
      )}
      {items.data?.length === 0 && (
        <EmptyState
          title="The Inbox is empty"
          description={
            intakeConfigured
              ? "New requests from email and the public form will show up here."
              : "Connect a Gmail label or turn on the public form to receive requests."
          }
          action={
            intakeConfigured ? undefined : (
              <Link
                href={`/w/${workspace.slug}/settings`}
                className={buttonVariants()}
              >
                Set up intake
              </Link>
            )
          }
        />
      )}
      {items.data && items.data.length > 0 && (
        <ul className="grid gap-3" aria-label="Pending requests">
          {items.data.map((item) => (
            <li key={item.id}>
              <IntakeItemCard
                item={item}
                project={project.data}
                members={members.data ?? []}
                labels={labels.data ?? []}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
