"use client";

import { MailIcon, SquarePenIcon, TriangleAlertIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { IntakeEditDialog } from "@/components/intake/intake-edit-dialog";
import { PriorityPill } from "@/components/task-ui";
import { Button } from "@/components/ui/button";
import { useAcceptIntake, useRejectIntake } from "@/hooks/use-intake";
import { errorMessage, type Schemas } from "@/lib/api/client";
import { formatDueDate, timeAgo } from "@/lib/tasks";
import { cn } from "@/lib/utils";

type Item = Schemas["IntakeItemOut"];

export function confidenceLabel(confidence: number): {
  text: string;
  className: string;
} {
  if (confidence >= 0.75)
    return {
      text: "High confidence",
      className: "text-ai",
    };
  if (confidence >= 0.4)
    return {
      text: "Medium confidence",
      className: "text-priority-high",
    };
  return {
    text: "Low confidence: please check",
    className: "text-destructive",
  };
}

export function IntakeItemCard({
  item,
  project,
  members,
  labels,
}: {
  item: Item;
  project: Schemas["ProjectOut"];
  members: Schemas["MemberOut"][];
  labels: Schemas["LabelOut"][];
}) {
  const accept = useAcceptIntake(project.id);
  const reject = useRejectIntake(project.id);
  const [editing, setEditing] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);
  const draft = item.draft;
  const confidence = confidenceLabel(item.confidence);
  const assignee = members.find((m) => m.user_id === draft.assignee_id);
  const busy = accept.isPending || reject.isPending;
  const headingId = `intake-${item.id}`;

  return (
    <article aria-labelledby={headingId} className="grid gap-[18px]">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#9a9aa0]">
        <span className="text-[#77777c]">From</span>
        <span className="text-[13px] font-medium break-all text-foreground">
          {item.sender}
        </span>
        <span className="flex items-center gap-1">
          ·{" "}
          {item.source === "email" ? (
            <MailIcon className="size-3" aria-hidden />
          ) : (
            <SquarePenIcon className="size-3" aria-hidden />
          )}
          {item.source === "email" ? "Email" : "Request form"}
        </span>
        <time dateTime={item.created_at}>· {timeAgo(item.created_at)}</time>
      </p>

      <div className="grid gap-2 rounded-[10px] border bg-card px-[18px] py-4">
        <p className="text-sm font-semibold">{item.raw_subject}</p>
        {/* Plain text: React escapes it, so nothing in the email can run. */}
        <p className="max-h-64 overflow-y-auto text-[13px] leading-relaxed whitespace-pre-wrap text-[#4a4a50]">
          {item.raw_body || "(no message)"}
        </p>
        <p className="text-[11.5px] text-[#9a9aa0]">
          Signatures and quoted replies are removed before the AI reads it.
        </p>
      </div>

      <div className="grid gap-3.5 rounded-[10px] border border-ai-border bg-ai-wash px-[18px] py-4">
        <p className="flex flex-wrap items-center gap-2">
          <span aria-hidden className="text-ai">
            ✦
          </span>
          <span className="text-[13px] font-semibold text-ai-ink">
            Proposed task
          </span>
          <span
            className={cn("ml-auto font-mono text-xs", confidence.className)}
          >
            {confidence.text} ({Math.round(item.confidence * 100)}%)
          </span>
        </p>
        <h3 id={headingId} className="text-[17px] font-semibold">
          {draft.title}
        </h3>
        {draft.description && (
          <p className="text-[13px] whitespace-pre-line text-muted-foreground">
            {draft.description}
          </p>
        )}
        <dl className="grid grid-cols-[90px_1fr] items-center gap-2.5 text-[13px] sm:grid-cols-[90px_1fr_90px_1fr] [&>dt]:text-[#77777c]">
          <dt>Project</dt>
          <dd>{project.name}</dd>
          <dt>Due</dt>
          <dd>
            {draft.due_date ? formatDueDate(draft.due_date) : "No due date"}
          </dd>
          <dt>Priority</dt>
          <dd>
            <PriorityPill priority={draft.priority ?? "medium"} />
          </dd>
          <dt>Assignee</dt>
          <dd className={cn(!assignee && "text-subtle")}>
            {assignee?.name ?? "Unassigned"}
          </dd>
          {(draft.labels ?? []).length > 0 && (
            <>
              <dt>Labels</dt>
              <dd className="flex flex-wrap gap-1.5 sm:col-span-3">
                {(draft.labels ?? []).map((name) => (
                  <span
                    key={name}
                    className="rounded-[5px] border border-[#e8e8e4] bg-secondary px-1.5 py-0.5 text-[11.5px]"
                  >
                    {name}
                  </span>
                ))}
              </dd>
            </>
          )}
        </dl>
        {(draft.warnings ?? []).length > 0 && (
          <ul className="grid gap-1 rounded-lg border border-warning-border bg-warning-soft px-3 py-2.5 text-[12.5px] text-warning-ink">
            {(draft.warnings ?? []).map((warning) => (
              <li key={warning} className="flex gap-1.5">
                <TriangleAlertIcon
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden
                />
                {warning}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy}
          onClick={() =>
            accept.mutate(
              { id: item.id },
              {
                onSuccess: () => toast.success("Task created from the request"),
                onError: (error) => toast.error(errorMessage(error)),
              },
            )
          }
        >
          Accept
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => setEditing(true)}
        >
          Edit then accept
        </Button>
        {confirmReject ? (
          <span className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground">
              Reject this request?
            </span>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() =>
                reject.mutate(item.id, {
                  onSuccess: () => toast.success("Request rejected"),
                  onError: (error) => toast.error(errorMessage(error)),
                })
              }
            >
              Reject
            </Button>
            <Button variant="ghost" onClick={() => setConfirmReject(false)}>
              Keep
            </Button>
          </span>
        ) : (
          <Button
            variant="ghost"
            className="text-destructive hover:text-destructive"
            disabled={busy}
            onClick={() => setConfirmReject(true)}
          >
            Reject
          </Button>
        )}
      </div>

      <IntakeEditDialog
        open={editing}
        onOpenChange={setEditing}
        item={item}
        project={project}
        members={members}
        labels={labels}
      />
    </article>
  );
}
