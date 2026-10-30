import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MappingStep } from "@/components/import/mapping-step";
import type { Schemas } from "@/lib/api/client";
import { csvCell, toCsv } from "@/lib/csv";
import { assignTarget, initialColumns } from "@/lib/import-mapping";

const job: Schemas["ImportJobOut"] = {
  id: "j1",
  workspace_id: "ws1",
  project_id: null,
  file_name: "messy_tasks.xlsx",
  sheet_name: "Tasks export",
  sheet_names: ["Tasks export", "Read me"],
  headers: ["Task Name", "State", "Prio", "Deadline", "Internal ID"],
  sample_rows: [["Send invoice", "WIP", "P1", "11/05/2026", "A-1"]],
  column_values: {
    "Task Name": ["Send invoice", "Call Acme"],
    State: ["WIP", "Closed", "Blocked"],
    Prio: ["P1", "P2"],
    Deadline: ["11/05/2026", "Nov 10, 2026"],
    "Internal ID": ["A-1", "A-2"],
  },
  total_rows: 2,
  status: "mapped",
  mapping: {
    columns: {
      "Task Name": "title",
      State: "status",
      Prio: "priority",
      Deadline: "due_date",
      "Internal ID": "ignore",
    },
    status_values: { WIP: "in_progress", Closed: "done" },
    priority_values: { P1: "urgent", P2: "high" },
    date_format: "%m/%d/%Y",
  },
  imported_rows: 0,
  created_at: "2026-10-30T00:00:00Z",
};

describe("mapping helpers", () => {
  it("defaults every header to Don't import", () => {
    expect(initialColumns(["A", "B"], null)).toEqual({
      A: "ignore",
      B: "ignore",
    });
  });

  it("moves a field to the newly chosen column", () => {
    const columns = assignTarget({ A: "title", B: "ignore" }, "B", "title");
    expect(columns).toEqual({ A: "ignore", B: "title" });
  });

  it("lets several columns be Don't import", () => {
    const columns = assignTarget({ A: "ignore", B: "title" }, "B", "ignore");
    expect(columns).toEqual({ A: "ignore", B: "ignore" });
  });
});

describe("safe CSV for skipped rows", () => {
  it.each([
    ['=HYPERLINK("http://evil")', '"\'=HYPERLINK(""http://evil"")"'],
    ["+1 555", "'+1 555"],
    ["-2", "'-2"],
    ["@SUM(A1)", "'@SUM(A1)"],
    ["plain, with comma", '"plain, with comma"'],
    [null, ""],
  ])("%s", (value, expected) => {
    expect(csvCell(value)).toBe(expected);
  });

  it("joins rows with CRLF so Excel reads them", () => {
    expect(toCsv(["Title", "Why"], [["x", "Missing title"]])).toBe(
      "Title,Why\r\nx,Missing title",
    );
  });
});

describe("MappingStep", () => {
  function renderStep(onSave = vi.fn()) {
    render(
      <MappingStep
        job={job}
        suggesting={false}
        saving={false}
        error={null}
        onSave={onSave}
        onBack={vi.fn()}
      />,
    );
    return onSave;
  }

  it("starts from the AI's mapping and shows every status value", () => {
    renderStep();

    expect(
      screen.getByRole("combobox", { name: 'Import "Task Name" as' }),
    ).toHaveTextContent("Task title");
    const statusValues = screen.getByRole("group", {
      name: 'Status values in "State"',
    });
    expect(
      within(statusValues).getByRole("combobox", { name: 'Treat "WIP" as' }),
    ).toHaveTextContent("In progress");
    // A value the AI couldn't place is shown, so the user can decide.
    expect(
      within(statusValues).getByRole("combobox", {
        name: 'Treat "Blocked" as',
      }),
    ).toHaveTextContent("Not mapped");
    expect(screen.getByText(/Suggested by AI/)).toBeInTheDocument();
  });

  it("saves the mapping as shown", () => {
    const onSave = renderStep();

    fireEvent.click(screen.getByRole("button", { name: "Next: preview" }));

    expect(onSave).toHaveBeenCalledWith(job.mapping);
  });

  it("needs a title column before continuing", () => {
    render(
      <MappingStep
        job={{ ...job, mapping: null }}
        suggesting={false}
        saving={false}
        error={null}
        onSave={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Choose which column holds the task title",
    );
    expect(
      screen.getByRole("button", { name: "Next: preview" }),
    ).toBeDisabled();
  });
});
