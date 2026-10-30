"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ErrorState } from "@/components/states";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateWorkspaceDialog } from "@/components/workspaces/create-workspace-dialog";
import { useLogout, useMe } from "@/hooks/use-auth";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { ROLE_LABELS } from "@/lib/roles";

// Tile colors from the design, picked by position.
const TILE_COLORS = ["#1c1c20", "#6847e0", "#2f9e5b", "#3b6fe0", "#d97a1f"];

export default function WorkspacePickerPage() {
  const router = useRouter();
  const me = useMe();
  const logout = useLogout();
  const workspaces = useWorkspaces();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-7 px-4 py-12">
      <div className="grid gap-1.5 text-center">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">
          Choose a workspace
        </h1>
        {me.data && (
          <p className="text-sm text-muted-foreground">
            Signed in as {me.data.email}
          </p>
        )}
      </div>

      <div className="w-full max-w-[480px] overflow-hidden rounded-xl border bg-card">
        {workspaces.isPending && (
          <div className="grid gap-px" aria-busy>
            <Skeleton className="m-4 h-9" />
            <Skeleton className="m-4 h-9" />
          </div>
        )}

        {workspaces.isError && (
          <ErrorState
            message="We couldn't load your workspaces."
            onRetry={() => workspaces.refetch()}
          />
        )}

        {workspaces.data?.length === 0 && (
          <div className="grid gap-1 border-b border-[#f0f0ec] px-[18px] py-5 text-center">
            <p className="font-medium">You&apos;re not in any workspace yet</p>
            <p className="text-sm text-muted-foreground">
              Create one for your team, or ask an admin to send you an invite
              link.
            </p>
          </div>
        )}

        {workspaces.data && workspaces.data.length > 0 && (
          <ul>
            {workspaces.data.map((workspace, index) => (
              <li key={workspace.id} className="border-b border-[#f0f0ec]">
                <Link
                  href={`/w/${workspace.slug}`}
                  className="flex items-center gap-3.5 px-[18px] py-4 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                >
                  <span
                    aria-hidden
                    className="flex size-9 shrink-0 items-center justify-center rounded-[9px] text-[13px] font-semibold text-white"
                    style={{
                      backgroundColor: TILE_COLORS[index % TILE_COLORS.length],
                    }}
                  >
                    {workspace.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className="truncate text-sm font-semibold">
                      {workspace.name}
                    </span>
                    <span className="truncate text-[12.5px] text-[#77777c]">
                      /w/{workspace.slug}
                    </span>
                  </span>
                  <span className="rounded-full border px-2 py-0.5 text-[11.5px] text-[#55555b]">
                    {ROLE_LABELS[workspace.role]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {!workspaces.isError && <CreateWorkspaceDialog asRow />}
      </div>

      <button
        type="button"
        className="text-[13px] text-muted-foreground hover:text-foreground hover:underline"
        disabled={logout.isPending}
        onClick={() =>
          logout.mutate(undefined, {
            onSettled: () => router.replace("/login"),
          })
        }
      >
        Log out
      </button>
    </main>
  );
}
