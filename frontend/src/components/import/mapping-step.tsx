"use client";

import { SparklesIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { errorMessage, type Schemas } from "@/lib/api/client";
import {
  assignTarget,
  columnFor,
  DATE_FORMATS,
  initialColumns,
  type Mapping,
  type Target,
  TARGETS,
} from "@/lib/import-mapping";
import { PRIORITIES, STATUSES } from "@/lib/tasks";
import { cn } from "@/lib/utils";

const UNMAPPED = "__unmapped";

type Props = {
  job: Schemas["ImportJobOut"];
  suggesting: boolean;
  saving: boolean;
  error: unknown;
  onSave: (mapping: Mapping) => void;
  onBack: () => void;
};

/**
 * Step 2: which column is which field, and how to read status, priority and dates.
 * Starts from the AI's suggestion; every choice can be changed.
 */
export function MappingStep({
  job,
  suggesting,
  saving,
  error,
  onSave,
  onBack,
}: Props) {
  const mapping = job.mapping;
  const [columns, setColumns] = useState(() =>
    initialColumns(job.headers, mapping),
  );
  const [statusValues, setStatusValues] = useState(
    mapping?.status_values ?? {},
  );
  const [priorityValues, setPriorityValues] = useState(
    mapping?.priority_values ?? {},
  );
  const [dateFormat, setDateFormat] = useState(mapping?.date_format ?? "");

  const titleColumn = columnFor(columns, "title");
  const statusColumn = columnFor(columns, "status");
  const priorityColumn = columnFor(columns, "priority");
  const dateColumn = columnFor(columns, "due_date");
  const dateItems = DATE_FORMATS.some((f) => f.value === dateFormat)
    ? DATE_FORMATS
    : [...DATE_FORMATS, { value: dateFormat, label: `Custom (${dateFormat})` }];

  const save = () =>
    onSave({
      columns,
      status_values: statusValues,
      priority_values: priorityValues,
      date_format: dateFormat || null,
    });

  const unmapped = [
    ...(statusColumn ? (job.column_values[statusColumn] ?? []) : []).filter(
      (v) => !(v in statusValues),
    ),
    ...(priorityColumn ? (job.column_values[priorityColumn] ?? []) : []).filter(
      (v) => !(v in priorityValues),
    ),
  ];

  return (
    <section aria-labelledby="mapping-heading" className="grid gap-4">
      <div>
        <h2 id="mapping-heading" className="text-base font-semibold">
          Map the columns
        </h2>
        <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          {suggesting ? (
            <>
              <SparklesIcon className="size-3.5 text-ai" aria-hidden />
              The AI is reading the headers and first 10 rows…
            </>
          ) : mapping ? (
            <>
              <SparklesIcon className="size-3.5 text-ai" aria-hidden />
              Suggested by AI. Check each column and change anything that&apos;s
              off.
            </>
          ) : (
            "Choose what each column contains."
          )}
        </p>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-[13px]">
            <thead className="border-b text-left text-[11.5px] text-subtle">
              <tr>
                <th scope="col" className="px-[18px] py-2.5 font-normal">
                  Column in file
                </th>
                <th scope="col" className="px-3 py-2.5 font-normal">
                  Sample values
                </th>
                <th scope="col" className="px-3 py-2.5 font-normal">
                  Maps to
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f2f2ef]">
              {job.headers.map((header) => (
                <tr key={header} className="h-[50px]">
                  <th
                    scope="row"
                    className="px-[18px] py-2 text-left font-mono text-[12.5px] font-normal"
                  >
                    {header}
                  </th>
                  <td className="max-w-56 truncate px-3 py-2 text-[12.5px] text-[#77777c]">
                    {(job.column_values[header] ?? [])
                      .slice(0, 3)
                      .join(" · ") || "(empty)"}
                  </td>
                  <td className="px-3 py-2">
                    <Select
                      items={TARGETS}
                      value={columns[header]}
                      disabled={suggesting}
                      onValueChange={(target) =>
                        target &&
                        setColumns((current) =>
                          assignTarget(current, header, target as Target),
                        )
                      }
                    >
                      <SelectTrigger
                        className={cn(
                          "w-44 font-mono text-[12.5px]",
                          columns[header] === "ignore"
                            ? "bg-[#f7f7f5] text-subtle"
                            : "border-ai-border bg-ai-wash text-ai-ink",
                        )}
                        aria-label={`Import "${header}" as`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TARGETS.map((target) => (
                          <SelectItem key={target.value} value={target.value}>
                            {target.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3.5">
          <div className="grid gap-4 rounded-xl border border-ai-border bg-ai-wash px-4 py-3.5">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-ai-ink">
              <span aria-hidden className="text-ai">
                ✦
              </span>
              Value cleanup
            </p>
            {!statusColumn && !priorityColumn && !dateColumn && (
              <p className="text-[12.5px] text-muted-foreground">
                Map a status, priority or due date column to clean up its
                values.
              </p>
            )}
            {statusColumn && (
              <ValueMap
                title={`Status values in "${statusColumn}"`}
                values={job.column_values[statusColumn] ?? []}
                options={STATUSES}
                unmappedLabel="Not mapped (To do)"
                chosen={statusValues}
                onChange={setStatusValues}
              />
            )}
            {priorityColumn && (
              <ValueMap
                title={`Priority values in "${priorityColumn}"`}
                values={job.column_values[priorityColumn] ?? []}
                options={PRIORITIES}
                unmappedLabel="Not mapped (Medium)"
                chosen={priorityValues}
                onChange={setPriorityValues}
              />
            )}
            {dateColumn && (
              <div className="grid gap-2">
                <Label
                  id="date-format-label"
                  className="text-[11px] font-normal tracking-[0.04em] text-[#77777c] uppercase"
                >
                  Dates in &quot;{dateColumn}&quot;
                </Label>
                <Select
                  items={dateItems}
                  value={dateFormat}
                  onValueChange={(value) => setDateFormat(value ?? "")}
                >
                  <SelectTrigger
                    aria-labelledby="date-format-label"
                    className="w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {dateItems.map((format) => (
                      <SelectItem key={format.value} value={format.value}>
                        {format.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Examples:{" "}
                  {(job.column_values[dateColumn] ?? [])
                    .slice(0, 4)
                    .join(" · ")}
                  . Dates like &quot;Nov 10, 2026&quot; are always understood.
                </p>
              </div>
            )}
          </div>

          {unmapped.length > 0 && (
            <div className="grid gap-1.5 rounded-xl border bg-card px-4 py-3.5 text-[12.5px]">
              <p className="text-[13px] font-semibold">
                {unmapped.length === 1
                  ? "1 value needs you"
                  : `${unmapped.length} values need you`}
              </p>
              <p className="text-muted-foreground">
                {unmapped
                  .slice(0, 3)
                  .map((v) => `"${v}"`)
                  .join(", ")}{" "}
                {unmapped.length === 1 ? "has" : "have"} no match yet. Unmapped
                values import with the default and a warning.
              </p>
            </div>
          )}

          {!titleColumn && (
            <p role="alert" className="text-sm text-destructive">
              Choose which column holds the task title.
            </p>
          )}
          {Boolean(error) && (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage(error)}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onBack} disabled={saving}>
              Back
            </Button>
            <Button
              onClick={save}
              disabled={!titleColumn || saving || suggesting}
            >
              {saving ? "Saving…" : "Next: preview"}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function ValueMap<V extends string>({
  title,
  values,
  options,
  unmappedLabel,
  chosen,
  onChange,
}: {
  title: string;
  values: string[];
  options: { value: V; label: string }[];
  unmappedLabel: string;
  chosen: Record<string, V>;
  onChange: (next: Record<string, V>) => void;
}) {
  const items = [{ value: UNMAPPED, label: unmappedLabel }, ...options];
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-[11px] tracking-[0.04em] text-[#77777c] uppercase">
        {title}
      </legend>
      <ul className="grid gap-1.5">
        {values.map((value) => (
          <li key={value} className="flex items-center gap-2">
            <span className="min-w-0 truncate rounded-[5px] border bg-card px-1.5 py-0.5 font-mono text-[12px]">
              {value}
            </span>
            <span aria-hidden className="text-[#b5b5b8]">
              →
            </span>
            <Select
              items={items}
              value={chosen[value] ?? UNMAPPED}
              onValueChange={(next) => {
                if (!next) return;
                const updated = { ...chosen };
                if (next === UNMAPPED) delete updated[value];
                else updated[value] = next as V;
                onChange(updated);
              }}
            >
              <SelectTrigger
                size="sm"
                className={cn(
                  "ml-auto w-36 bg-card text-xs",
                  chosen[value] ? "text-[#4a32b0]" : "text-subtle",
                )}
                aria-label={`Treat "${value}" as`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
