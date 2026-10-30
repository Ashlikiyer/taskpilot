"use client";

import { SparklesIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useSuggestSubtasks } from "@/hooks/use-ai";
import { useCreateTask } from "@/hooks/use-tasks";
import { ApiError, errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/utils";

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
        variant="ai-soft"
        size="sm"
        className="w-fit border"
        onClick={start}
        disabled={suggest.isPending}
      >
        <SparklesIcon />
        {suggest.isPending ? "Thinking…" : "Break down with AI"}
      </Button>
    );
  }

  return (
    <fieldset className="overflow-hidden rounded-[10px] border border-ai-border bg-ai-wash">
      <legend className="sr-only">Suggested subtasks</legend>
      <div className="flex flex-wrap items-center gap-2 border-b border-[#ebe5fc] px-3.5 py-2.5">
        <span aria-hidden className="text-ai">
          ✦
        </span>
        <span className="text-[13px] font-semibold text-ai-ink">
          Break down with AI
        </span>
        <span className="text-xs text-ai-muted">
          {suggestions.length} suggestions · untick what you don&apos;t need
        </span>
      </div>
      <ul className="grid gap-1.5 px-3.5 py-2.5">
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
            <span
              id={`suggestion-${taskId}-${index}`}
              className={cn(
                "text-[13px]",
                !picked.has(index) && "text-[#77777c]",
              )}
            >
              {title}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex justify-end gap-2 border-t border-[#ebe5fc] px-3.5 py-2.5">
        <Button
          size="sm"
          variant="ghost"
          disabled={creating}
          onClick={() => setSuggestions(null)}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          variant="ai"
          onClick={create}
          disabled={picked.size === 0 || creating}
        >
          {creating
            ? "Adding…"
            : `Add ${picked.size} ${picked.size === 1 ? "subtask" : "subtasks"}`}
        </Button>
      </div>
    </fieldset>
  );
}
