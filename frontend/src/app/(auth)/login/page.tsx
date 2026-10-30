"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { AuthForm } from "@/components/auth/auth-form";
import { useLogin } from "@/hooks/use-auth";
import { errorMessage } from "@/lib/api/client";
import { safeRedirect } from "@/lib/safe-redirect";

// The public demo account from scripts/seed.py; `/login?demo=1` fills it in.
const DEMO = { email: "demo@taskpilot.dev", password: "taskpilot-demo" };

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const demo = params.get("demo") === "1";
  const login = useLogin();
  const [error, setError] = useState<string>();

  return (
    <AuthForm
      mode="login"
      error={error}
      nextPath={next ?? undefined}
      defaults={demo ? DEMO : undefined}
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
