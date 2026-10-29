"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { AuthForm } from "@/components/auth/auth-form";
import { useLogin } from "@/hooks/use-auth";
import { errorMessage } from "@/lib/api/client";
import { safeRedirect } from "@/lib/safe-redirect";

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const login = useLogin();
  const [error, setError] = useState<string>();

  return (
    <AuthForm
      mode="login"
      error={error}
      nextPath={next ?? undefined}
      onSubmit={async (values) => {
        setError(undefined);
        try {
          await login.mutateAsync(values);
          router.replace(safeRedirect(next));
        } catch (err) {
          setError(errorMessage(err));
        }
      }}
    />
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
