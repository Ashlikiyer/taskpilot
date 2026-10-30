"use client";

import Link from "next/link";
import { useState } from "react";

import {
  confidenceLabel,
  IntakeItemCard,
} from "@/components/intake/intake-item-card";
import { EmptyState, ErrorState } from "@/components/states";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useIntakeItems } from "@/hooks/use-intake";
import { useCurrentProject } from "@/hooks/use-projects";
import { useLabels } from "@/hooks/use-tasks";
import { useCurrentWorkspace, useMembers } from "@/hooks/use-workspaces";
import { hasRole } from "@/lib/roles";
import { timeAgo } from "@/lib/tasks";
import { cn } from "@/lib/utils";

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
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

  // The first request is open until the admin picks another one.
  const selected =
    items.data?.find((item) => item.id === selectedId) ?? items.data?.[0];

  return (
    <div className="grid gap-4">
      <p className="text-[13px] text-muted-foreground">
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
      {items.data && items.data.length > 0 && selected && (
        <div className="grid overflow-hidden rounded-xl border bg-background md:grid-cols-[340px_minmax(0,1fr)]">
          <ul
            aria-label="Pending requests"
            className="border-b bg-card md:border-r md:border-b-0"
          >
            {items.data.map((item) => {
              const active = item.id === selected.id;
              const percent = Math.round(item.confidence * 100);
              return (
                <li key={item.id} className="border-b border-[#f0f0ec]">
                  <button
                    type="button"
                    aria-current={active ? "true" : undefined}
                    onClick={() => setSelectedId(item.id)}
                    className={cn(
                      "grid w-full gap-1.5 px-[18px] py-3.5 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
                      active &&
                        "bg-[#f7f5fe] shadow-[inset_3px_0_0_var(--ai)] hover:bg-[#f7f5fe]",
                    )}
                  >
                    <span className="flex items-center gap-2 text-[11.5px] text-[#77777c]">
                      <span className="font-mono uppercase">{item.source}</span>
                      <span>·</span>
                      <span className="min-w-0 flex-1 truncate">
                        {item.sender}
                      </span>
                      <span>{timeAgo(item.created_at)}</span>
                    </span>
                    <span className="text-[13.5px] font-medium">
                      {item.draft.title}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="h-1 w-[60px] overflow-hidden rounded-sm bg-[#ece9f8]">
                        <span
                          className="block h-full bg-ai"
                          style={{ width: `${percent}%` }}
                        />
                      </span>
                      <span className="font-mono text-[11px] text-ai">
                        {item.confidence.toFixed(2)}
                        <span className="sr-only">
                          {" "}
                          {confidenceLabel(item.confidence).text}
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="min-w-0 p-5 md:px-7 md:py-6">
            <IntakeItemCard
              key={selected.id}
              item={selected}
              project={project.data}
              members={members.data ?? []}
              labels={labels.data ?? []}
            />
          </div>
        </div>
      )}
    </div>
  );
}
