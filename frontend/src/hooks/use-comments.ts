import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, type Schemas } from "@/lib/api/client";

type Comment = Schemas["CommentOut"];

const commentsKey = (taskId: string) => ["tasks", taskId, "comments"] as const;

export function useComments(taskId: string) {
  return useQuery({
    queryKey: commentsKey(taskId),
    queryFn: () => api.get<Comment[]>(`/tasks/${taskId}/comments`),
  });
}

export function useCreateComment(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      api.post<Comment>(`/tasks/${taskId}/comments`, { body }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: commentsKey(taskId) }),
  });
}

export function useUpdateComment(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      api.patch<Comment>(`/comments/${id}`, { body }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: commentsKey(taskId) }),
  });
}

export function useDeleteComment(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/comments/${id}`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: commentsKey(taskId) }),
  });
}
