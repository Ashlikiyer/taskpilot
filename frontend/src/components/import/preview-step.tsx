"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { errorMessage, type Schemas } from "@/lib/api/client";
import { formatDueDate, PRIORITY_LABEL, STATUS_LABEL } from "@/lib/tasks";
import { cn } from "@/lib/utils";

const NONE = "none";

const ISSUE_CLASS = {
  error: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  warning: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  info: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
} as const;

type Props = {
  projects: Schemas["ProjectOut"][];
  projectId: string | null;
  allowDuplicates: boolean;
  onOptionsChange: (projectId: string | null, allowDuplicates: boolean) => void;
  preview: Schemas["PreviewResult"] | undefined;
  previewing: boolean;
  importing: boolean;
  error: unknown;
  onImport: () => void;
  onBack: () => void;
};

/** Step 3: a dry run of every row. Nothing is saved until "Import". */
export function PreviewStep({
  projects,
  projectId,
  allowDuplicates,
  onOptionsChange,
  preview,
  previewing,
  importing,
  error,
  onImport,
  onBack,
}: Props) {
  const projectItems = [
    { value: NONE, label: "Choose a project" },
    ...projects.map((p) => ({ value: p.id, label: p.name })),
  ];

  return (
    <section aria-labelledby="preview-heading" className="grid gap-5">
      <div>
        <h2 id="preview-heading" className="text-lg font-semibold">
          Preview
        </h2>
        <p className="text-sm text-muted-foreground">
          A dry run: every row is checked, and nothing is saved yet.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-6">
        <div className="grid gap-2">
          <Label id="import-project-label">Import into</Label>
          <Select
            items={projectItems}
            value={projectId ?? NONE}
            onValueChange={(value) =>
              value &&
              onOptionsChange(value === NONE ? null : value, allowDuplicates)
            }
          >
            <SelectTrigger
              aria-labelledby="import-project-label"
              className="w-56"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {projectItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 pb-2">
          <Checkbox
            id="allow-duplicates"
            aria-labelledby="allow-duplicates-label"
            checked={allowDuplicates}
            onCheckedChange={(checked) => onOptionsChange(projectId, checked)}
          />
          <Label
            id="allow-duplicates-label"
            htmlFor="allow-duplicates"
            className="font-normal"
          >
            Allow duplicates (same title and due date as an existing task)
          </Label>
        </div>
      </div>

      {!projectId && (
        <p className="text-sm text-muted-foreground">
          Choose a project to see the preview.
        </p>
      )}
      {previewing && (
        <p className="text-sm text-muted-foreground">Checking every row…</p>
      )}
      {Boolean(error) && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(error)}
        </p>
      )}

      {preview && projectId && (
        <>
          <dl
            className="grid grid-cols-2 gap-3 sm:grid-cols-4"
            aria-live="polite"
          >
            <Stat label="Rows" value={preview.total_rows} />
            <Stat label="Ready to import" value={preview.valid_rows} />
            <Stat
              label="With warnings"
              value={preview.rows_with_warnings}
              tone="text-amber-700 dark:text-amber-400"
            />
            <Stat
              label="Skipped (errors)"
              value={preview.rows_with_errors}
              tone="text-destructive"
            />
          </dl>
          {preview.new_labels.length > 0 && (
            <p className="text-sm text-muted-foreground">
              New labels to create: {preview.new_labels.join(", ")}
            </p>
          )}

          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <caption className="sr-only">
                First {preview.rows.length} rows with what will be imported and
                any problems
              </caption>
              <thead className="bg-muted/50 text-left">
                <tr>
                  {[
                    "Row",
                    "Title",
                    "Status",
                    "Priority",
                    "Assignee",
                    "Due",
                    "Labels",
                    "Notes",
                  ].map((heading) => (
                    <th
                      key={heading}
                      scope="col"
                      className="px-3 py-2 font-medium"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {preview.rows.map((row) => {
                  const hasError = row.issues.some((i) => i.level === "error");
                  return (
                    <tr
                      key={row.row_number}
                      className={cn(
                        hasError && "bg-red-50/60 dark:bg-red-950/30",
                      )}
                    >
                      <td className="px-3 py-2 text-muted-foreground">
                        {row.row_number}
                      </td>
                      <td className="max-w-56 truncate px-3 py-2">
                        {row.title ?? (
                          <span className="text-muted-foreground">(none)</span>
                        )}
                      </td>
                      <td className="px-3 py-2">{STATUS_LABEL[row.status]}</td>
                      <td className="px-3 py-2">
                        {PRIORITY_LABEL[row.priority]}
                      </td>
                      <td className="px-3 py-2">
                        {row.assignee_name ?? "Unassigned"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {row.due_date ? formatDueDate(row.due_date) : "None"}
                      </td>
                      <td className="px-3 py-2">{row.labels.join(", ")}</td>
                      <td className="min-w-64 px-3 py-2">
                        <ul className="grid gap-1">
                          {row.issues.map((issue) => (
                            <li
                              key={issue.message}
                              className={cn(
                                "rounded px-1.5 py-0.5 text-xs",
                                ISSUE_CLASS[issue.level],
                              )}
                            >
                              <span className="sr-only">{issue.level}: </span>
                              {issue.message}
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {preview.total_rows > preview.rows.length && (
            <p className="text-xs text-muted-foreground">
              Showing the first {preview.rows.length} of {preview.total_rows}{" "}
              rows; every row is checked.
            </p>
          )}
        </>
      )}

      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack} disabled={importing}>
          Back
        </Button>
        <Button
          onClick={onImport}
          disabled={
            !preview ||
            !projectId ||
            preview.valid_rows === 0 ||
            importing ||
            previewing
          }
        >
          {importing
            ? "Importing…"
            : `Import ${preview?.valid_rows ?? 0} ${preview?.valid_rows === 1 ? "task" : "tasks"}`}
        </Button>
        {preview && preview.rows_with_errors > 0 && (
          <Badge variant="secondary" className="self-center">
            {preview.rows_with_errors} skipped
          </Badge>
        )}
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("text-2xl font-semibold", tone)}>{value}</dd>
    </div>
  );
}
