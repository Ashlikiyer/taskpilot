"use client";

import { FolderIcon, SearchIcon, SquareCheckIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useProjects } from "@/hooks/use-projects";
import { useWorkspaceSearch } from "@/hooks/use-tasks";
import type { Schemas } from "@/lib/api/client";
import { STATUS_LABEL } from "@/lib/tasks";
import { cn } from "@/lib/utils";

const SEARCH_DELAY_MS = 200;

type Result =
  | {
      kind: "project";
      id: string;
      href: string;
      project: Schemas["ProjectOut"];
    }
  | { kind: "task"; id: string; href: string; task: Schemas["TaskOut"] };

/** Ctrl/Cmd+K: search tasks and jump to projects, fully usable from the keyboard. */
export function CommandMenu({
  workspace,
}: {
  workspace: Schemas["WorkspaceOut"];
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <Button
        variant="outline"
        className="w-full justify-start text-muted-foreground"
        onClick={() => setOpen(true)}
        aria-keyshortcuts="Control+K Meta+K"
      >
        <SearchIcon />
        Search
        <kbd className="ml-auto rounded border px-1.5 font-mono text-xs">
          Ctrl K
        </kbd>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="top-[15%] translate-y-0 gap-0 p-0 sm:max-w-lg"
          showCloseButton={false}
        >
          {/* Remount on open so each search starts empty. */}
          {open && (
            <SearchPanel workspace={workspace} onDone={() => setOpen(false)} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function SearchPanel({
  workspace,
  onDone,
}: {
  workspace: Schemas["WorkspaceOut"];
  onDone: () => void;
}) {
  const router = useRouter();
  const listId = useId();
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const search = useWorkspaceSearch(workspace.id, query);
  const projects = useProjects(workspace.id, { includeArchived: true });

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(text);
      setActive(0);
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const base = `/w/${workspace.slug}`;
  const projectName = new Map((projects.data ?? []).map((p) => [p.id, p.name]));
  const results: Result[] = query.trim()
    ? [
        ...(search.data?.projects ?? []).map((project) => ({
          kind: "project" as const,
          id: project.id,
          href: `${base}/p/${project.id}`,
          project,
        })),
        ...(search.data?.tasks ?? []).map((task) => ({
          kind: "task" as const,
          id: task.id,
          href: `${base}/p/${task.project_id}?task=${task.id}`,
          task,
        })),
      ]
    : [];
  const optionId = (index: number) => `${listId}-option-${index}`;

  const choose = (result: Result | undefined) => {
    if (!result) return;
    onDone();
    router.push(result.href);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(results[active]);
    }
  };

  return (
    <div className="grid">
      <DialogTitle className="sr-only">Search {workspace.name}</DialogTitle>
      <DialogDescription className="sr-only">
        Type to search tasks and projects. Use the arrow keys to pick a result
        and Enter to open it.
      </DialogDescription>
      <div className="flex items-center gap-2 border-b px-3">
        <SearchIcon className="size-4 text-muted-foreground" aria-hidden />
        <input
          autoFocus
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            results.length > 0 ? optionId(active) : undefined
          }
          aria-label="Search tasks and projects"
          placeholder="Search tasks and projects…"
          value={text}
          maxLength={100}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      <ul
        id={listId}
        role="listbox"
        aria-label="Results"
        className="max-h-80 overflow-y-auto p-2"
      >
        {results.map((result, index) => (
          <li
            key={`${result.kind}-${result.id}`}
            id={optionId(index)}
            role="option"
            aria-selected={index === active}
            onMouseMove={() => setActive(index)}
            onClick={() => choose(result)}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm",
              index === active && "bg-muted",
            )}
          >
            {result.kind === "project" ? (
              <>
                <FolderIcon
                  className="size-4 shrink-0"
                  style={{ color: result.project.color }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate">
                  {result.project.name}
                </span>
                {result.project.archived_at && (
                  <Badge variant="secondary">Archived</Badge>
                )}
                <span className="text-xs text-muted-foreground">Project</span>
              </>
            ) : (
              <>
                <SquareCheckIcon
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate">
                  {result.task.title}
                </span>
                <span className="max-w-32 truncate text-xs text-muted-foreground">
                  {projectName.get(result.task.project_id) ?? "Task"} ·{" "}
                  {STATUS_LABEL[result.task.status]}
                </span>
              </>
            )}
          </li>
        ))}
      </ul>

      <p
        className="border-t px-3 py-2 text-xs text-muted-foreground"
        aria-live="polite"
      >
        {!query.trim()
          ? "Type to search task titles, descriptions and project names."
          : search.isError
            ? "Search failed. Try again."
            : search.isFetching && results.length === 0
              ? "Searching…"
              : results.length === 0
                ? `No results for "${query.trim()}".`
                : `${results.length} ${results.length === 1 ? "result" : "results"} · ↑↓ to move · Enter to open`}
      </p>
    </div>
  );
}
