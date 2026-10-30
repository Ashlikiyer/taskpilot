import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

/** The task open in the drawer, kept in the URL as `?task=<id>` so it can be shared. */
export function useTaskParam() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // An empty `?task=` means no task, not a drawer stuck loading.
  const taskId = searchParams.get("task") || null;

  const setTaskId = useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id) params.set("task", id);
      else params.delete("task");
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return [taskId, setTaskId] as const;
}
