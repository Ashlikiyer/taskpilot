import { useMutation } from "@tanstack/react-query";

import { api, type Schemas } from "@/lib/api/client";

/** Ask the AI for a task draft. Nothing is saved; the preview confirms it. */
export function useQuickAdd(wsId: string) {
  return useMutation({
    mutationFn: (data: Schemas["QuickAddRequest"]) =>
      api.post<Schemas["QuickAddDraft"]>(
        `/workspaces/${wsId}/ai/quick-add`,
        data,
      ),
  });
}

/** Ask the AI for 3–8 subtask ideas. Nothing is saved; the user ticks which to create. */
export function useSuggestSubtasks(taskId: string) {
  return useMutation({
    mutationFn: () =>
      api.post<Schemas["SubtaskSuggestions"]>(`/tasks/${taskId}/ai/subtasks`),
  });
}

/** Summarize a long comment thread. The backend caches it until a comment changes. */
export function useSummarizeThread(taskId: string) {
  return useMutation({
    mutationFn: () =>
      api.post<Schemas["ThreadSummaryOut"]>(`/tasks/${taskId}/ai/summary`),
  });
}
