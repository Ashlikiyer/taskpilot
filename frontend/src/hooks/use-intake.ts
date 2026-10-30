import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, type Schemas } from "@/lib/api/client";

type IntakeItem = Schemas["IntakeItemOut"];

const intakeKey = (projectId: string) =>
  ["projects", projectId, "intake"] as const;

/** Pending proposals in a project's Inbox (admins only). */
export function useIntakeItems(projectId: string, enabled: boolean) {
  return useQuery({
    queryKey: intakeKey(projectId),
    queryFn: () => api.get<IntakeItem[]>(`/projects/${projectId}/intake`),
    enabled,
    refetchInterval: 60_000, // new emails arrive every few minutes
  });
}

/** Accepting creates a task, so the board, project counts and Inbox all refresh. */
function useAfterIntakeChange(projectId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: intakeKey(projectId) }),
      queryClient.invalidateQueries({
        queryKey: ["projects", projectId, "tasks"],
      }),
      queryClient.invalidateQueries({ queryKey: ["projects", projectId] }),
      queryClient.invalidateQueries({
        predicate: (q) =>
          q.queryKey[0] === "workspaces" && q.queryKey[2] === "projects",
      }),
    ]);
}

export function useAcceptIntake(projectId: string) {
  const refresh = useAfterIntakeChange(projectId);
  return useMutation({
    mutationFn: ({
      id,
      edits,
    }: {
      id: string;
      edits?: Schemas["IntakeAccept"];
    }) => api.post<IntakeItem>(`/intake/${id}/accept`, edits ?? {}),
    onSuccess: refresh,
  });
}

export function useRejectIntake(projectId: string) {
  const refresh = useAfterIntakeChange(projectId);
  return useMutation({
    mutationFn: (id: string) => api.post<IntakeItem>(`/intake/${id}/reject`),
    onSuccess: refresh,
  });
}
