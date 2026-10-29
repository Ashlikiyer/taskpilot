import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, type Schemas } from "@/lib/api/client";

type Project = Schemas["ProjectOut"];

export const projectKeys = {
  workspace: (wsId: string) => ["workspaces", wsId, "projects"] as const,
  list: (wsId: string, includeArchived: boolean) =>
    [...projectKeys.workspace(wsId), { includeArchived }] as const,
  detail: (projectId: string) => ["projects", projectId] as const,
};

export function useProjects(
  wsId: string | undefined,
  { includeArchived = false }: { includeArchived?: boolean } = {},
) {
  return useQuery({
    queryKey: projectKeys.list(wsId ?? "", includeArchived),
    queryFn: () =>
      api.get<Project[]>(
        `/workspaces/${wsId}/projects${includeArchived ? "?include_archived=true" : ""}`,
      ),
    enabled: Boolean(wsId),
  });
}

export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: projectKeys.detail(projectId ?? ""),
    queryFn: () => api.get<Project>(`/projects/${projectId}`),
    enabled: Boolean(projectId),
  });
}

/** After any project change, refresh that project and every project list in its workspace. */
function useSyncProject() {
  const queryClient = useQueryClient();
  return (project: Project) => {
    queryClient.setQueryData(projectKeys.detail(project.id), project);
    return queryClient.invalidateQueries({
      queryKey: projectKeys.workspace(project.workspace_id),
    });
  };
}

export function useCreateProject(wsId: string) {
  const sync = useSyncProject();
  return useMutation({
    mutationFn: (data: Schemas["ProjectCreate"]) =>
      api.post<Project>(`/workspaces/${wsId}/projects`, data),
    onSuccess: sync,
  });
}

export function useUpdateProject(projectId: string) {
  const sync = useSyncProject();
  return useMutation({
    mutationFn: (data: Schemas["ProjectUpdate"]) =>
      api.patch<Project>(`/projects/${projectId}`, data),
    onSuccess: sync,
  });
}

export function useSetProjectArchived(projectId: string) {
  const sync = useSyncProject();
  return useMutation({
    mutationFn: (archived: boolean) =>
      api.post<Project>(
        `/projects/${projectId}/${archived ? "archive" : "restore"}`,
      ),
    onSuccess: sync,
  });
}
