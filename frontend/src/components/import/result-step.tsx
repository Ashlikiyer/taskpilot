"use client";

import { CircleCheckIcon, DownloadIcon } from "lucide-react";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import type { Schemas } from "@/lib/api/client";
import { downloadCsv, toCsv } from "@/lib/csv";

type Props = {
  result: Schemas["ImportResult"];
  headers: string[];
  fileName: string;
  projectName: string;
  boardHref: string;
  onStartOver: () => void;
};

/** Step 4: what was imported, and the skipped rows as a CSV to fix and re-upload. */
export function ResultStep({
  result,
  headers,
  fileName,
  projectName,
  boardHref,
  onStartOver,
}: Props) {
  const skipped = result.skipped_rows;

  const download = () =>
    downloadCsv(
      `${fileName.replace(/\.(csv|xlsx)$/i, "")}-skipped-rows.csv`,
      toCsv(
        [...headers, "Why it was skipped"],
        skipped.map((row) => [
          ...headers.map((header) => row.values[header] ?? ""),
          row.reasons.join("; "),
        ]),
      ),
    );

  return (
    <section
      aria-labelledby="result-heading"
      className="grid gap-4"
      role="status"
    >
      <h2
        id="result-heading"
        className="flex items-center gap-2 text-lg font-semibold"
      >
        <CircleCheckIcon className="size-5 text-emerald-600" aria-hidden />
        Imported {result.imported_rows}{" "}
        {result.imported_rows === 1 ? "task" : "tasks"} into {projectName}
      </h2>
      {result.labels_created.length > 0 && (
        <p className="text-sm text-muted-foreground">
          New labels: {result.labels_created.join(", ")}
        </p>
      )}

      {skipped.length > 0 && (
        <div className="grid gap-2 rounded-xl border p-4">
          <p className="text-sm">
            {skipped.length} {skipped.length === 1 ? "row was" : "rows were"}{" "}
            skipped. Download them, fix the problems and upload the file again.
          </p>
          <ul className="grid gap-1 text-sm text-muted-foreground">
            {skipped.slice(0, 5).map((row) => (
              <li key={row.row_number}>
                Row {row.row_number}: {row.reasons.join("; ")}
              </li>
            ))}
            {skipped.length > 5 && <li>…and {skipped.length - 5} more</li>}
          </ul>
          <Button variant="outline" className="w-fit" onClick={download}>
            <DownloadIcon />
            Download skipped rows (CSV)
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Link href={boardHref} className={buttonVariants()}>
          Open the board
        </Link>
        <Button variant="outline" onClick={onStartOver}>
          Import another file
        </Button>
      </div>
    </section>
  );
}
