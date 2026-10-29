"use client";

import { useParams, useRouter } from "next/navigation";

import { RequireAuth } from "@/components/auth/require-auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useLogout, useMe } from "@/hooks/use-auth";
import { useAcceptInvite } from "@/hooks/use-workspaces";
import { ApiError, errorMessage } from "@/lib/api/client";

function InviteCard() {
  const router = useRouter();
  const { token } = useParams<{ token: string }>();
  const me = useMe();
  const accept = useAcceptInvite();
  const logout = useLogout();
  const wrongAccount =
    accept.error instanceof ApiError && accept.error.status === 403;

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">You&apos;ve been invited</CardTitle>
        <CardDescription>
          Join the workspace as{" "}
          <span className="font-medium">{me.data?.email}</span>.
        </CardDescription>
      </CardHeader>
      {accept.isError && (
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>{errorMessage(accept.error)}</AlertDescription>
          </Alert>
        </CardContent>
      )}
      <CardFooter className="flex flex-col gap-2">
        <Button
          className="w-full"
          disabled={accept.isPending}
          onClick={() =>
            accept.mutate(token, {
              onSuccess: (workspace) => router.push(`/w/${workspace.slug}`),
            })
          }
        >
          {accept.isPending ? "Joining…" : "Accept invite"}
        </Button>
        {wrongAccount && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() =>
              logout.mutate(undefined, {
                onSettled: () =>
                  router.replace(
                    `/login?next=${encodeURIComponent(`/invite/${token}`)}`,
                  ),
              })
            }
          >
            Log in with another account
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

export default function InvitePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
      <p className="text-2xl font-semibold tracking-tight">TaskPilot</p>
      <RequireAuth>
        <InviteCard />
      </RequireAuth>
    </main>
  );
}
