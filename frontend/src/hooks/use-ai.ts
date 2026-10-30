import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, type Schemas } from "@/lib/api/client";

export const aiUsageKey = ["ai", "usage"] as const;

/** The current user's AI calls today, shown in the sidebar. */
export function useAIUsage() {
  return useQuery({
    queryKey: aiUsageKey,
    queryFn: () => api.get<Schemas["AIUsageOut"]>("/ai/usage"),
    staleTime: 60_000,
  });
}

/** Refresh the usage count after any AI call, whether it worked or not. */
export function useRefreshAIUsage() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: aiUsageKey });
}

/** Ask the AI for a task draft. Nothing is saved; the preview confirms it. */
export function useQuickAdd(wsId: string) {
  const refreshUsage = useRefreshAIUsage();
  return useMutation({
    mutationFn: (data: Schemas["QuickAddRequest"]) =>
      api.post<Schemas["QuickAddDraft"]>(
        `/workspaces/${wsId}/ai/quick-add`,
        data,
      ),
    onSettled: refreshUsage,
  });
}

/** Ask the AI for 3–8 subtask ideas. Nothing is saved; the user ticks which to create. */
export function useSuggestSubtasks(taskId: string) {
  const refreshUsage = useRefreshAIUsage();
  return useMutation({
    mutationFn: () =>
      api.post<Schemas["SubtaskSuggestions"]>(`/tasks/${taskId}/ai/subtasks`),
    onSettled: refreshUsage,
  });
}

/** Summarize a long comment thread. The backend caches it until a comment changes. */
export function useSummarizeThread(taskId: string) {
  const refreshUsage = useRefreshAIUsage();
  return useMutation({
    mutationFn: () =>
      api.post<Schemas["ThreadSummaryOut"]>(`/tasks/${taskId}/ai/summary`),
    onSettled: refreshUsage,
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
