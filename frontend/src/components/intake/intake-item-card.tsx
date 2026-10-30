"use client";

import { MailIcon, SquarePenIcon, TriangleAlertIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { IntakeEditDialog } from "@/components/intake/intake-edit-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAcceptIntake, useRejectIntake } from "@/hooks/use-intake";
import { errorMessage, type Schemas } from "@/lib/api/client";
import {
  formatDueDate,
  PRIORITY_CLASS,
  PRIORITY_LABEL,
  timeAgo,
} from "@/lib/tasks";
import { cn } from "@/lib/utils";

type Item = Schemas["IntakeItemOut"];

export function confidenceLabel(confidence: number): {
  text: string;
  className: string;
} {
  if (confidence >= 0.75)
    return {
      text: "High confidence",
      className: "text-emerald-700 dark:text-emerald-400",
    };
  if (confidence >= 0.4)
    return {
      text: "Medium confidence",
      className: "text-amber-700 dark:text-amber-400",
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
    <article
      aria-labelledby={headingId}
      className="grid gap-3 rounded-xl border p-4"
    >
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary">
          {item.source === "email" ? <MailIcon /> : <SquarePenIcon />}
          {item.source === "email" ? "Email" : "Form"}
        </Badge>
        <span className="truncate">From {item.sender}</span>
        <time dateTime={item.created_at}>· {timeAgo(item.created_at)}</time>
        <span className={cn("ml-auto font-medium", confidence.className)}>
          {confidence.text} ({Math.round(item.confidence * 100)}%)
        </span>
      </div>

      <div className="grid gap-1">
        <h3 id={headingId} className="font-medium">
          {draft.title}
        </h3>
        {draft.description && (
          <p className="text-sm whitespace-pre-line text-muted-foreground">
            {draft.description}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span
          className={cn(
            "rounded px-1.5 py-0.5",
            PRIORITY_CLASS[draft.priority ?? "medium"],
          )}
        >
          {PRIORITY_LABEL[draft.priority ?? "medium"]}
        </span>
        <span className="text-muted-foreground">
          {draft.due_date
            ? `Due ${formatDueDate(draft.due_date)}`
            : "No due date"}
        </span>
        <span className="text-muted-foreground">
          · {assignee?.name ?? "Unassigned"}
        </span>
        {(draft.labels ?? []).map((name) => (
          <span key={name} className="rounded-full border px-2 py-0.5">
            {name}
          </span>
        ))}
      </div>

      {(draft.warnings ?? []).length > 0 && (
        <ul className="grid gap-1 rounded-md bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
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

      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">
          Original message
        </summary>
        <div className="mt-2 grid gap-1 rounded-md bg-muted p-3">
          <p className="font-medium">{item.raw_subject}</p>
          {/* Plain text: React escapes it, so nothing in the email can run. */}
          <p className="max-h-64 overflow-y-auto text-xs whitespace-pre-wrap">
            {item.raw_body || "(no message)"}
          </p>
        </div>
      </details>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
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
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => setEditing(true)}
        >
          Edit &amp; accept
        </Button>
        {confirmReject ? (
          <span className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground">
              Reject this request?
            </span>
            <Button
              size="sm"
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
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirmReject(false)}
            >
              Keep
            </Button>
          </span>
        ) : (
          <Button
            size="sm"
            variant="ghost"
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
