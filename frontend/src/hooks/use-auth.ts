import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, authApi, type Schemas } from "@/lib/api/client";

export const meQueryKey = ["me"] as const;

export function useMe() {
  return useQuery({
    queryKey: meQueryKey,
    queryFn: () => api.get<Schemas["UserOut"]>("/auth/me"),
    retry: false,
    staleTime: 5 * 60_000,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Schemas["LoginRequest"]) => {
      await authApi.login(data.email, data.password);
    },
    onSuccess: () => queryClient.resetQueries(),
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Schemas["RegisterRequest"]) => {
      await authApi.register(data);
      await authApi.login(data.email, data.password);
    },
    onSuccess: () => queryClient.resetQueries(),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.logout,
    onSettled: () => queryClient.clear(),
  });
}
