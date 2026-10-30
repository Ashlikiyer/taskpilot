import { useMutation, useQuery } from "@tanstack/react-query";

import { ApiError, type Schemas } from "@/lib/api/client";

/**
 * The public request form is used without logging in, so these calls skip the
 * authenticated API client (no token, no refresh attempt).
 */
async function publicRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1${path}`, init);
  if (!response.ok) {
    let code = "HTTP_ERROR";
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as {
        error?: { code?: string; message?: string };
      };
      code = body.error?.code ?? code;
      message = body.error?.message ?? message;
    } catch {
      // not JSON
    }
    throw new ApiError(response.status, code, message);
  }
  return (await response.json()) as T;
}

export function useIntakeForm(slug: string) {
  return useQuery({
    queryKey: ["intake-form", slug],
    queryFn: () =>
      publicRequest<Schemas["IntakeFormInfo"]>(
        `/intake/form/${encodeURIComponent(slug)}`,
      ),
    retry: false,
  });
}

export function useSubmitIntakeForm(slug: string) {
  return useMutation({
    mutationFn: (data: Schemas["IntakeFormSubmission"]) =>
      publicRequest<{ received: boolean }>(
        `/intake/form/${encodeURIComponent(slug)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
      ),
  });
}
