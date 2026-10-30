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

  return (
    <section aria-labelledby="mapping-heading" className="grid gap-6">
      <div>
        <h2 id="mapping-heading" className="text-lg font-semibold">
          Map the columns
        </h2>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {suggesting ? (
            <>
              <SparklesIcon className="size-3.5 text-primary" aria-hidden />
              The AI is reading the headers and first 10 rows…
            </>
          ) : mapping ? (
            <>
              <SparklesIcon className="size-3.5 text-primary" aria-hidden />
              Suggested by AI. Check each column and change anything that&apos;s
              off.
            </>
          ) : (
            "Choose what each column contains."
          )}
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                Column
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Example values
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Import as
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {job.headers.map((header) => (
              <tr key={header}>
                <th scope="row" className="px-3 py-2 text-left font-medium">
                  {header}
                </th>
                <td className="max-w-64 truncate px-3 py-2 text-muted-foreground">
                  {(job.column_values[header] ?? []).slice(0, 3).join(" · ") ||
                    "(empty)"}
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
                      className="w-40"
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

      {statusColumn && (
        <ValueMap
          title={`Status values in "${statusColumn}"`}
          values={job.column_values[statusColumn] ?? []}
          options={STATUSES}
          unmappedLabel="Not mapped (To do, with a warning)"
          chosen={statusValues}
          onChange={setStatusValues}
        />
      )}
      {priorityColumn && (
        <ValueMap
          title={`Priority values in "${priorityColumn}"`}
          values={job.column_values[priorityColumn] ?? []}
          options={PRIORITIES}
          unmappedLabel="Not mapped (Medium, with a warning)"
          chosen={priorityValues}
          onChange={setPriorityValues}
        />
      )}
      {dateColumn && (
        <div className="grid max-w-sm gap-2">
          <Label id="date-format-label">
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
            {(job.column_values[dateColumn] ?? []).slice(0, 4).join(" · ")}.
            Dates like &quot;Nov 10, 2026&quot; are always understood.
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
      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack} disabled={saving}>
          Back
        </Button>
        <Button onClick={save} disabled={!titleColumn || saving || suggesting}>
          {saving ? "Saving…" : "Next: preview"}
        </Button>
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
      <legend className="mb-1 text-sm font-medium">{title}</legend>
      <ul className="grid gap-2 sm:grid-cols-2">
        {values.map((value) => (
          <li
            key={value}
            className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
          >
            <span className="truncate text-sm">&quot;{value}&quot;</span>
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
                className="w-44"
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
