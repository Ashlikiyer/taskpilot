"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateProject } from "@/hooks/use-projects";
import { errorMessage, type Schemas } from "@/lib/api/client";

export function formUrl(slug: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/intake/${slug}`;
}

/** One project's intake settings: its Gmail label and the public request form. */
export function IntakeSettingsRow({
  project,
}: {
  project: Schemas["ProjectOut"];
}) {
  const update = useUpdateProject(project.id);
  const [label, setLabel] = useState(project.intake_email_label ?? "");
  const [copied, setCopied] = useState(false);
  const labelId = `intake-label-${project.id}`;
  const formId = `intake-form-${project.id}`;
  const labelChanged = label.trim() !== (project.intake_email_label ?? "");

  const save = (data: Schemas["ProjectUpdate"], message: string) =>
    update.mutate(data, {
      onSuccess: () => toast.success(message),
      onError: (error) => toast.error(errorMessage(error)),
    });

  const copy = async () => {
    if (!project.intake_slug) return;
    try {
      await navigator.clipboard.writeText(formUrl(project.intake_slug));
      setCopied(true);
      toast.success("Form link copied");
    } catch {
      toast.error("Couldn't copy. Select the link and copy it manually.");
    }
  };

  return (
    <li className="grid gap-3 rounded-xl border p-4">
      <h3 className="flex items-center gap-2 font-medium">
        <span
          aria-hidden
          className="size-2.5 rounded-full"
          style={{ backgroundColor: project.color }}
        />
        {project.name}
      </h3>

      <form
        className="grid gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          save(
            { intake_email_label: label.trim() || null },
            label.trim() ? "Gmail label saved" : "Email intake turned off",
          );
        }}
      >
        <Label htmlFor={labelId}>Gmail label</Label>
        <div className="flex flex-wrap gap-2">
          <Input
            id={labelId}
            value={label}
            maxLength={200}
            placeholder="TaskPilot/Project-Name"
            onChange={(e) => setLabel(e.target.value)}
            className="min-w-0 flex-1 basis-56"
            aria-describedby={`${labelId}-help`}
          />
          <Button
            type="submit"
            variant="outline"
            disabled={!labelChanged || update.isPending}
          >
            Save
          </Button>
        </div>
        <p id={`${labelId}-help`} className="text-xs text-muted-foreground">
          Emails with this label are sent to this project&apos;s Inbox by the
          Gmail script. Leave it empty to turn email intake off.
        </p>
      </form>

      <div className="grid gap-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id={formId}
            aria-labelledby={`${formId}-text`}
            checked={project.intake_form_enabled}
            disabled={update.isPending}
            onCheckedChange={(checked) =>
              save(
                { intake_form_enabled: checked },
                checked ? "Public form turned on" : "Public form turned off",
              )
            }
          />
          <Label id={`${formId}-text`} htmlFor={formId} className="font-normal">
            Public request form (no login needed)
          </Label>
        </div>
        {project.intake_form_enabled && project.intake_slug && (
          <div className="flex gap-2">
            <Input
              readOnly
              value={formUrl(project.intake_slug)}
              aria-label={`Public form link for ${project.name}`}
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={copy}
              aria-label="Copy form link"
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}
