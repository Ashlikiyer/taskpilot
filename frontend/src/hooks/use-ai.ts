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
