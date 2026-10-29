"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { AuthForm } from "@/components/auth/auth-form";
import { useRegister } from "@/hooks/use-auth";
import { errorMessage } from "@/lib/api/client";
import { safeRedirect } from "@/lib/safe-redirect";

function RegisterForm() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const registerUser = useRegister();
  const [error, setError] = useState<string>();

  return (
    <AuthForm
      mode="register"
      error={error}
      nextPath={next ?? undefined}
      onSubmit={async (values) => {
        setError(undefined);
        try {
          await registerUser.mutateAsync(values);
          router.replace(safeRedirect(next));
        } catch (err) {
          setError(errorMessage(err));
        }
      }}
    />
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
