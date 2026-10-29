"use client";

import { useHealth } from "@/hooks/use-health";

export function BackendStatus() {
  const { data, isPending, isError } = useHealth();

  let label = "Checking backend…";
  let tone = "bg-muted-foreground";
  if (isError) {
    label = "Backend unreachable";
    tone = "bg-destructive";
  } else if (data?.status === "ok") {
    label = "Backend online";
    tone = "bg-emerald-500";
  } else if (data) {
    label = "Backend online, database unavailable";
    tone = "bg-amber-500";
  }

  return (
    <p
      role="status"
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm text-muted-foreground"
    >
      <span
        aria-hidden
        className={`size-2 rounded-full ${tone} ${isPending ? "animate-pulse" : ""}`}
      />
      {label}
    </p>
  );
}
