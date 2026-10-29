"use client";

import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";

import { ErrorState } from "@/components/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api/client";

function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center p-8" aria-busy>
      <Skeleton className="h-8 w-48" />
    </div>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const me = useMe();
  const loggedOut = me.error instanceof ApiError && me.error.status === 401;

  useEffect(() => {
    if (loggedOut)
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [loggedOut, pathname, router]);

  if (me.isError && !loggedOut) {
    return (
      <ErrorState
        message="We couldn't reach TaskPilot. Check your connection and try again."
        onRetry={() => me.refetch()}
      />
    );
  }
  if (!me.isSuccess) return <Loading />;
  return children;
}

/**
 * Renders children only for a logged-in user; otherwise sends them to /login.
 * The Suspense boundary lets routes with dynamic params (which make usePathname
 * and useParams suspend under Cache Components) prerender a loading shell.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<Loading />}>
      <AuthGate>{children}</AuthGate>
    </Suspense>
  );
}
