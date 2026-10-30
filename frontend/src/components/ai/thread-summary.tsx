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
        variant="ai-soft"
        size="sm"
        className="w-fit border"
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
      className="grid gap-2.5 rounded-[10px] border border-ai-border px-3.5 py-3"
    >
      <h4
        id={`summary-${taskId}`}
        className="flex items-center gap-2 text-[13px] font-semibold text-ai-ink"
      >
        <span aria-hidden className="text-ai">
          ✦
        </span>
        Thread summary
        <span className="ml-auto text-xs font-normal text-subtle">
          {timeAgo(summary.generated_at)}
        </span>
      </h4>
      <div className="grid gap-3.5 sm:grid-cols-3">
        {SECTIONS.map(({ key, title }) => (
          <div key={key} className="grid content-start gap-1">
            <h5 className="text-[11px] tracking-[0.04em] text-[#77777c] uppercase">
              {title}
            </h5>
            {summary[key].length === 0 ? (
              <p className="text-sm text-muted-foreground">None</p>
            ) : (
              <ul className="grid gap-1 text-[12.5px] leading-snug">
                {summary[key].map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
      <p className="text-[11.5px] text-ai-muted">
        Written by AI from the comments below. It refreshes after the thread
        changes.
      </p>
    </section>
  );
}
