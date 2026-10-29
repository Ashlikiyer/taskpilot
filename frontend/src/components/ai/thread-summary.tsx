"use client";

import { SparklesIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useSummarizeThread } from "@/hooks/use-ai";
import { ApiError, errorMessage } from "@/lib/api/client";
import { timeAgo } from "@/lib/tasks";

/** The spec offers "Summarize" once a task has more than 5 comments. */
export const SUMMARY_MIN_COMMENTS = 6;

const SECTIONS = [
  { key: "decisions", title: "Decisions" },
  { key: "open_questions", title: "Open questions" },
  { key: "next_steps", title: "Next steps" },
] as const;

/**
 * Summarizes the thread into decisions, open questions and next steps. The backend
 * caches the result, so asking again is instant until someone comments. Mount it
 * with a `key` that changes with the thread so an old summary isn't shown.
 */
export function ThreadSummary({ taskId }: { taskId: string }) {
  const summarize = useSummarizeThread(taskId);
  const summary = summarize.data;

  if (!summary) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="w-fit"
        disabled={summarize.isPending}
        onClick={() =>
          summarize.mutate(undefined, {
            onError: (error) =>
              toast.error(
                error instanceof ApiError && error.code === "AI_DAILY_LIMIT"
                  ? error.message
                  : `The AI couldn't summarize this thread. ${errorMessage(error)}`,
              ),
          })
        }
      >
        <SparklesIcon />
        {summarize.isPending ? "Summarizing…" : "Summarize"}
      </Button>
    );
  }

  return (
    <section
      aria-labelledby={`summary-${taskId}`}
      className="grid gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3"
    >
      <h4
        id={`summary-${taskId}`}
        className="flex items-center gap-1.5 text-sm font-medium"
      >
        <SparklesIcon className="size-3.5 text-primary" aria-hidden />
        Thread summary
        <span className="ml-auto text-xs font-normal text-muted-foreground">
          {timeAgo(summary.generated_at)}
        </span>
      </h4>
      {SECTIONS.map(({ key, title }) => (
        <div key={key} className="grid gap-1">
          <h5 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {title}
          </h5>
          {summary[key].length === 0 ? (
            <p className="text-sm text-muted-foreground">None</p>
          ) : (
            <ul className="list-disc pl-5 text-sm">
              {summary[key].map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        Written by AI from the comments below. It refreshes after the thread
        changes.
      </p>
    </section>
  );
}
