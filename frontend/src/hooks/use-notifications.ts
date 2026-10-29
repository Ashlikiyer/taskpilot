import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, type Schemas } from "@/lib/api/client";

type NotificationList = Schemas["NotificationList"];

const notificationsKey = ["notifications"] as const;
// Real-time push is out of scope (spec), so the bell polls.
const POLL_MS = 30_000;

export function useNotifications() {
  return useQuery({
    queryKey: notificationsKey,
    queryFn: () => api.get<NotificationList>("/notifications?limit=30"),
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<Schemas["NotificationOut"]>(`/notifications/${id}/read`),
    onMutate: (id) => {
      // Update the badge right away; the next poll confirms it.
      queryClient.setQueryData<NotificationList>(
        notificationsKey,
        (list) =>
          list && {
            unread_count: Math.max(0, list.unread_count - 1),
            items: list.items.map((n) =>
              n.id === id
                ? { ...n, read_at: n.read_at ?? new Date().toISOString() }
                : n,
            ),
          },
      );
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: notificationsKey }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<void>("/notifications/read-all"),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: notificationsKey }),
  });
}
