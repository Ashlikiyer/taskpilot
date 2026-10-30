"use client";

import { BellIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/hooks/use-notifications";
import { errorMessage } from "@/lib/api/client";
import { describeNotification, notificationHref } from "@/lib/notifications";
import { timeAgo } from "@/lib/tasks";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const router = useRouter();
  const notifications = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const unread = notifications.data?.unread_count ?? 0;
  const items = notifications.data?.items ?? [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            className="relative size-[34px] shrink-0 rounded-[9px] bg-card"
          />
        }
        aria-label={
          unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
        }
      >
        <BellIcon />
        {unread > 0 && (
          <span
            aria-hidden
            className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full border-[1.5px] border-card bg-[#d9443a] px-1 text-[10px] font-semibold text-white"
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 max-w-[calc(100vw-2rem)]"
      >
        <DropdownMenuGroup>
          <div className="flex items-center justify-between">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            {unread > 0 && (
              <Button
                size="xs"
                variant="ghost"
                disabled={markAllRead.isPending}
                onClick={() =>
                  markAllRead.mutate(undefined, {
                    onError: (error) => toast.error(errorMessage(error)),
                  })
                }
              >
                Mark all read
              </Button>
            )}
          </div>
          <DropdownMenuSeparator />
          {notifications.isPending && (
            <p className="px-2 py-3 text-sm text-muted-foreground">Loading…</p>
          )}
          {notifications.isError && (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              Couldn&apos;t load notifications.
            </p>
          )}
          {notifications.data && items.length === 0 && (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              You&apos;re all caught up.
            </p>
          )}
          <div className="max-h-96 overflow-y-auto">
            {items.map((notification) => {
              const { title, detail } = describeNotification(notification);
              const href = notificationHref(notification);
              const isUnread = notification.read_at === null;
              return (
                <DropdownMenuItem
                  key={notification.id}
                  onClick={() => {
                    if (isUnread) markRead.mutate(notification.id);
                    if (href) router.push(href);
                  }}
                  className="flex items-start gap-2 py-2"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      isUnread ? "bg-primary" : "bg-transparent",
                    )}
                  />
                  <span className="grid min-w-0 gap-0.5">
                    <span className={cn("text-sm", isUnread && "font-medium")}>
                      {isUnread && <span className="sr-only">Unread: </span>}
                      {title}
                    </span>
                    {detail && (
                      <span className="line-clamp-2 text-xs text-muted-foreground">
                        {detail}
                      </span>
                    )}
                    <time
                      dateTime={notification.created_at}
                      className="text-xs text-muted-foreground"
                    >
                      {timeAgo(notification.created_at)}
                    </time>
                  </span>
                </DropdownMenuItem>
              );
            })}
          </div>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
