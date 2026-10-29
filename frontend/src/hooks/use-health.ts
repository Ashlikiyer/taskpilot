import { useQuery } from "@tanstack/react-query";

import type { components } from "@/lib/api/schema";

export type HealthResponse = components["schemas"]["HealthResponse"];

async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch("/api/v1/health");
  // 503 still carries a HealthResponse body ("degraded"); anything else is an outage.
  if (!response.ok && response.status !== 503) {
    throw new Error(`Health check failed with status ${response.status}`);
  }
  return (await response.json()) as HealthResponse;
}

export function useHealth() {
  return useQuery({ queryKey: ["health"], queryFn: fetchHealth });
}
