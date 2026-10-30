import { useQuery } from "@tanstack/react-query";

import { api, type Schemas } from "@/lib/api/client";

/** Workspace numbers for the dashboard, optionally for one project. */
export function useDashboard(
  wsId: string | undefined,
  projectId: string | null,
) {
  return useQuery({
    queryKey: ["workspaces", wsId, "dashboard", projectId],
    queryFn: () =>
      api.get<Schemas["DashboardOut"]>(
        `/workspaces/${wsId}/dashboard${projectId ? `?project_id=${projectId}` : ""}`,
      ),
    enabled: Boolean(wsId),
  });
}
