import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useRefreshAIUsage } from "@/hooks/use-ai";
import { api, type Schemas } from "@/lib/api/client";

type Job = Schemas["ImportJobOut"];

const jobKey = (jobId: string) => ["imports", jobId] as const;

export function useImportJob(jobId: string | null) {
  return useQuery({
    queryKey: jobKey(jobId ?? ""),
    queryFn: () => api.get<Job>(`/imports/${jobId}`),
    enabled: Boolean(jobId),
  });
}

/** Step 1: upload a .csv or .xlsx. `sheet` picks another Excel sheet. */
export function useUploadImport(wsId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, sheet }: { file: File; sheet?: string }) => {
      const form = new FormData();
      form.append("file", file);
      if (sheet) form.append("sheet", sheet);
      return api.post<Job>(`/workspaces/${wsId}/imports`, form);
    },
    onSuccess: (job) => queryClient.setQueryData(jobKey(job.id), job),
  });
}

/** Step 2: ask the AI for a mapping (headers and first 10 rows only). */
export function useSuggestMapping(jobId: string) {
  const queryClient = useQueryClient();
  const refreshUsage = useRefreshAIUsage();
  return useMutation({
    mutationFn: () => api.post<Job>(`/imports/${jobId}/mapping`),
    onSuccess: (job) => queryClient.setQueryData(jobKey(job.id), job),
    onSettled: refreshUsage,
  });
}

/** Step 2: save the mapping as the user edited it. */
export function useSaveMapping(jobId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (mapping: Schemas["ImportMapping"]) =>
      api.put<Job>(`/imports/${jobId}/mapping`, mapping),
    onSuccess: (job) => queryClient.setQueryData(jobKey(job.id), job),
  });
}

/** Step 3: dry run. Nothing is saved. */
export function usePreviewImport(jobId: string) {
  return useMutation({
    mutationFn: (options: Schemas["ImportOptions"]) =>
      api.post<Schemas["PreviewResult"]>(`/imports/${jobId}/preview`, options),
  });
}

/** Step 4: import valid rows in one transaction. */
export function useRunImport(jobId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (options: Schemas["ImportOptions"]) =>
      api.post<Schemas["ImportResult"]>(`/imports/${jobId}/run`, options),
    onSuccess: (_result, options) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: jobKey(jobId) }),
        queryClient.invalidateQueries({
          queryKey: ["projects", options.project_id, "tasks"],
        }),
      ]),
  });
}
