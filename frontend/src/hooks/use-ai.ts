import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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

/**
 * Today's digest. The backend builds it on first view if the morning job hasn't
 * run, and marks it read, so the bell is refreshed afterwards.
 */
export function useDigestToday(wsId: string | undefined) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ["workspaces", wsId, "digest", "today"],
    queryFn: async () => {
      const digest = await api.get<Schemas["DigestOut"]>(
        `/workspaces/${wsId}/digest/today`,
      );
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      return digest;
    },
    enabled: Boolean(wsId),
    staleTime: 5 * 60_000,
  });
}
