"use client";

import { LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useLogout, useMe } from "@/hooks/use-auth";

export function UserMenu() {
  const router = useRouter();
  const me = useMe();
  const logout = useLogout();

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0 text-sm">
        <p className="truncate font-medium">{me.data?.name}</p>
        <p className="truncate text-muted-foreground">{me.data?.email}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Log out"
        title="Log out"
        disabled={logout.isPending}
        onClick={() =>
          logout.mutate(undefined, {
            onSettled: () => router.replace("/login"),
          })
        }
      >
        <LogOutIcon />
      </Button>
    </div>
  );
}
