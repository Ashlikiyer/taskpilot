"use client";

import { SparklesIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useSuggestSubtasks } from "@/hooks/use-ai";
import { useCreateTask } from "@/hooks/use-tasks";
import { ApiError, errorMessage } from "@/lib/api/client";

/**
 * "Break down with AI": suggests 3–8 subtasks, all ticked to start. The user unticks
 * what they don't want; only the ticked ones are created, in the suggested order.
 */
export function SubtaskBreakdown({
  taskId,
  projectId,
}: {
  taskId: string;
  projectId: string;
}) {
  const suggest = useSuggestSubtasks(taskId);
  const createTask = useCreateTask(projectId);
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [creating, setCreating] = useState(false);

  const start = () =>
    suggest.mutate(undefined, {
      onSuccess: ({ subtasks }) => {
        if (subtasks.length === 0) {
          toast.info(
            "The AI had nothing new to add. This task may already be broken down.",
          );
          return;
        }
        setSuggestions(subtasks);
        setPicked(new Set(subtasks.map((_, index) => index)));
      },
      onError: (error) =>
        toast.error(
          error instanceof ApiError && error.code === "AI_DAILY_LIMIT"
            ? error.message
            : `The AI couldn't suggest subtasks. ${errorMessage(error)}`,
        ),
    });

  const create = async () => {
    if (!suggestions) return;
    const titles = suggestions.filter((_, index) => picked.has(index));
    setCreating(true);
    let created = 0;
    try {
      // One at a time, so the subtasks keep the suggested order.
      for (const title of titles) {
        await createTask.mutateAsync({ title, parent_id: taskId });
        created += 1;
      }
      toast.success(
        `Added ${created} ${created === 1 ? "subtask" : "subtasks"}`,
      );
      setSuggestions(null);
    } catch (error) {
      toast.error(
        `Added ${created} of ${titles.length} subtasks. ${errorMessage(error)}`,
      );
      setSuggestions(titles.slice(created));
      setPicked(new Set(titles.slice(created).map((_, index) => index)));
    } finally {
      setCreating(false);
    }
  };

  if (!suggestions) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="w-fit"
        onClick={start}
        disabled={suggest.isPending}
      >
        <SparklesIcon />
        {suggest.isPending ? "Thinking…" : "Break down with AI"}
      </Button>
    );
  }

  return (
    <fieldset className="grid gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <legend className="flex items-center gap-1.5 px-1 text-sm font-medium">
        <SparklesIcon className="size-3.5 text-primary" aria-hidden />
        Suggested subtasks
      </legend>
      <p className="text-xs text-muted-foreground">
        Untick anything you don&apos;t need. Nothing is added until you confirm.
      </p>
      <ul className="grid gap-1.5">
        {suggestions.map((title, index) => (
          <li key={`${index}-${title}`} className="flex items-start gap-2">
            <Checkbox
              className="mt-0.5"
              aria-labelledby={`suggestion-${taskId}-${index}`}
              checked={picked.has(index)}
              onCheckedChange={(checked) =>
                setPicked((current) => {
                  const next = new Set(current);
                  if (checked) next.add(index);
                  else next.delete(index);
                  return next;
                })
              }
            />
            <span id={`suggestion-${taskId}-${index}`} className="text-sm">
              {title}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={create}
          disabled={picked.size === 0 || creating}
        >
          {creating
            ? "Adding…"
            : `Add ${picked.size} ${picked.size === 1 ? "subtask" : "subtasks"}`}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={creating}
          onClick={() => setSuggestions(null)}
        >
          Cancel
        </Button>
      </div>
    </fieldset>
  );
}
