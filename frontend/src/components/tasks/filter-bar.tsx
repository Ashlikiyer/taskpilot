"use client";

import { ChevronDownIcon, SearchIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Schemas } from "@/lib/api/client";
import {
  EMPTY_FILTERS,
  hasActiveFilters,
  type TaskFilters,
} from "@/lib/task-filters";
import { PRIORITIES, STATUSES } from "@/lib/tasks";

const ANY = "any";
const SEARCH_DELAY_MS = 300;

type Props = {
  filters: TaskFilters;
  onChange: (filters: TaskFilters) => void;
  members: Schemas["MemberOut"][];
  labels: Schemas["LabelOut"][];
};

/** Every change resets to page 1, since the old page may no longer exist. */
export function FilterBar({ filters, onChange, members, labels }: Props) {
  const update = (patch: Partial<TaskFilters>) =>
    onChange({ ...filters, ...patch, page: 1 });
  const [search, setSearch] = useState(filters.q);

  // Search as you type, but wait for a pause so each keystroke isn't a request.
  useEffect(() => {
    if (search === filters.q) return;
    const timer = setTimeout(() => update({ q: search }), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run on typing
  }, [search]);

  const assigneeItems = [
    { value: ANY, label: "Anyone" },
    ...members.map((m) => ({ value: m.user_id, label: m.name })),
  ];
  const labelItems = [
    { value: ANY, label: "Any label" },
    ...labels.map((l) => ({ value: l.id, label: l.name })),
  ];

  return (
    <div
      role="search"
      aria-label="Filter tasks"
      className="flex flex-wrap items-end gap-3"
    >
      <div className="relative w-full sm:w-64">
        <SearchIcon
          aria-hidden
          className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          aria-label="Search tasks"
          placeholder="Search title and description"
          value={search}
          maxLength={100}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      <MultiSelect
        label="Status"
        options={STATUSES}
        selected={filters.status}
        onChange={(status) => update({ status })}
      />
      <MultiSelect
        label="Priority"
        options={PRIORITIES}
        selected={filters.priority}
        onChange={(priority) => update({ priority })}
      />

      <Select
        items={assigneeItems}
        value={filters.assignee ?? ANY}
        onValueChange={(value) =>
          update({ assignee: !value || value === ANY ? null : value })
        }
      >
        <SelectTrigger className="w-36" aria-label="Assignee">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {assigneeItems.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        items={labelItems}
        value={filters.label ?? ANY}
        onValueChange={(value) =>
          update({ label: !value || value === ANY ? null : value })
        }
      >
        <SelectTrigger className="w-36" aria-label="Label">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {labelItems.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="grid gap-1">
        <Label htmlFor="due-from" className="text-xs text-muted-foreground">
          Due from
        </Label>
        <Input
          id="due-from"
          type="date"
          className="w-36"
          value={filters.dueFrom ?? ""}
          onChange={(e) => update({ dueFrom: e.target.value || null })}
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="due-to" className="text-xs text-muted-foreground">
          Due to
        </Label>
        <Input
          id="due-to"
          type="date"
          className="w-36"
          value={filters.dueTo ?? ""}
          onChange={(e) => update({ dueTo: e.target.value || null })}
        />
      </div>

      {hasActiveFilters(filters) && (
        <Button
          variant="ghost"
          onClick={() => {
            setSearch("");
            onChange({ ...EMPTY_FILTERS, sort: filters.sort });
          }}
        >
          <XIcon />
          Clear filters
        </Button>
      )}
    </div>
  );
}

function MultiSelect<T extends string>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  selected: T[];
  onChange: (values: T[]) => void;
}) {
  const summary =
    selected.length === 0
      ? `Any ${label.toLowerCase()}`
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label
        : `${label}: ${selected.length}`;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" className="w-36 justify-between" />}
        aria-label={`${label} filter, ${summary}`}
      >
        <span className="truncate">{summary}</span>
        <ChevronDownIcon className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuGroup>
          {options.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={selected.includes(option.value)}
              onCheckedChange={(checked) =>
                onChange(
                  checked
                    ? [...selected, option.value]
                    : selected.filter((value) => value !== option.value),
                )
              }
            >
              {option.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
