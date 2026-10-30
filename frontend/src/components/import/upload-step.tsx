"use client";

import { FileSpreadsheetIcon } from "lucide-react";
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

const MAX_BYTES = 5 * 1024 * 1024;

type Props = {
  job: Schemas["ImportJobOut"] | undefined;
  uploading: boolean;
  error: unknown;
  onUpload: (file: File, sheet?: string) => void;
  onNext: () => void;
};

/** Step 1: pick a file (and, for Excel, a sheet). */
export function UploadStep({ job, uploading, error, onUpload, onNext }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<string>();

  const choose = (picked: File | undefined) => {
    setProblem(undefined);
    if (!picked) return;
    const name = picked.name.toLowerCase();
    if (!name.endsWith(".csv") && !name.endsWith(".xlsx")) {
      setProblem("Choose a .csv or .xlsx file.");
      return;
    }
    if (picked.size > MAX_BYTES) {
      setProblem("The file is larger than 5 MB.");
      return;
    }
    setFile(picked);
    onUpload(picked);
  };

  const sheetItems = (job?.sheet_names ?? []).map((name) => ({
    value: name,
    label: name,
  }));

  return (
    <section aria-labelledby="upload-heading" className="grid gap-4">
      <div>
        <h2 id="upload-heading" className="text-lg font-semibold">
          Upload a task list
        </h2>
        <p className="text-sm text-muted-foreground">
          A .csv or .xlsx export from another tool, up to 5 MB and 2,000 rows.
          Nothing is added to your projects until the last step.
        </p>
      </div>

      <label
        htmlFor="import-file"
        className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center hover:bg-muted focus-within:ring-2 focus-within:ring-ring"
      >
        <FileSpreadsheetIcon
          className="size-8 text-muted-foreground"
          aria-hidden
        />
        <span className="font-medium">
          {file ? file.name : "Choose a file"}
        </span>
        <span className="text-sm text-muted-foreground">
          {uploading ? "Reading the file…" : ".csv or .xlsx"}
        </span>
        <input
          id="import-file"
          type="file"
          accept=".csv,.xlsx"
          className="sr-only"
          disabled={uploading}
          onChange={(e) => choose(e.target.files?.[0])}
        />
      </label>

      {(problem || Boolean(error)) && (
        <p role="alert" className="text-sm text-destructive">
          {problem ?? errorMessage(error)}
        </p>
      )}

      {job && (
        <div className="grid gap-3 rounded-xl border p-4 text-sm">
          <p>
            <span className="font-medium">{job.file_name}</span>:{" "}
            {job.total_rows} {job.total_rows === 1 ? "row" : "rows"},{" "}
            {job.headers.length} columns.
          </p>
          {sheetItems.length > 1 && file && (
            <div className="grid max-w-xs gap-2">
              <Label id="import-sheet-label">Sheet</Label>
              <Select
                items={sheetItems}
                value={job.sheet_name ?? sheetItems[0].value}
                onValueChange={(sheet) => sheet && onUpload(file, sheet)}
              >
                <SelectTrigger
                  aria-labelledby="import-sheet-label"
                  className="w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sheetItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button className="w-fit" onClick={onNext} disabled={uploading}>
            Next: map columns
          </Button>
        </div>
      )}
    </section>
  );
}
