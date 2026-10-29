import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";

import { api, type Schemas } from "@/lib/api/client";

type Workspace = Schemas["WorkspaceOut"];
type Member = Schemas["MemberOut"];

export const workspaceKeys = {
  all: ["workspaces"] as const,
  members: (wsId: string) => ["workspaces", wsId, "members"] as const,
};

export function useWorkspaces() {
  return useQuery({
    queryKey: workspaceKeys.all,
    queryFn: () => api.get<Workspace[]>("/workspaces"),
  });
}

/** The workspace for the `[slug]` in the current URL, from the cached workspace list. */
export function useCurrentWorkspace() {
  const { slug } = useParams<{ slug: string }>();
  const query = useWorkspaces();
  return {
    ...query,
    workspace: query.data?.find((w) => w.slug === slug),
    slug,
  };
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Schemas["WorkspaceCreate"]) =>
      api.post<Workspace>("/workspaces", data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all }),
  });
}

export function useMembers(wsId: string | undefined) {
  return useQuery({
    queryKey: workspaceKeys.members(wsId ?? ""),
    queryFn: () => api.get<Member[]>(`/workspaces/${wsId}/members`),
    enabled: Boolean(wsId),
  });
}

export function useUpdateMemberRole(wsId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      role,
    }: {
      userId: string;
      role: Schemas["MemberUpdate"]["role"];
    }) => api.patch<Member>(`/workspaces/${wsId}/members/${userId}`, { role }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: workspaceKeys.members(wsId) }),
  });
}

export function useRemoveMember(wsId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      api.delete(`/workspaces/${wsId}/members/${userId}`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: workspaceKeys.members(wsId) }),
  });
}

export function useCreateInvite(wsId: string) {
  return useMutation({
    mutationFn: (data: Schemas["InviteCreate"]) =>
      api.post<Schemas["InviteOut"]>(`/workspaces/${wsId}/invites`, data),
  });
}

export function useAcceptInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) =>
      api.post<Workspace>(`/invites/${encodeURIComponent(token)}/accept`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all }),
  });
}
