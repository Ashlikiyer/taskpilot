"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const loginSchema = z.object({
  email: z.email("Enter a valid email").max(320),
  password: z.string().min(1, "Enter your password").max(128),
});

const registerSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(100),
  email: z.email("Enter a valid email").max(320),
  password: z
    .string()
    .min(8, "Use at least 8 characters")
    .max(128, "Use at most 128 characters"),
});

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;

type Props =
  | {
      mode: "login";
      onSubmit: (values: LoginValues) => Promise<void>;
      error?: string;
      nextPath?: string;
    }
  | {
      mode: "register";
      onSubmit: (values: RegisterValues) => Promise<void>;
      error?: string;
      nextPath?: string;
    };

type FormValues = { name?: string; email: string; password: string };

export function AuthForm(props: Props) {
  const isRegister = props.mode === "register";
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(isRegister ? registerSchema : loginSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const submit = handleSubmit(async (values) => {
    if (props.mode === "register")
      await props.onSubmit(values as RegisterValues);
    else await props.onSubmit(values as LoginValues);
  });

  const switchHref = `${isRegister ? "/login" : "/register"}${
    props.nextPath ? `?next=${encodeURIComponent(props.nextPath)}` : ""
  }`;

  return (
    <div className="grid gap-5">
      <div className="grid gap-1.5">
        <h1 className="text-[28px] font-semibold tracking-[-0.02em]">
          {isRegister ? "Create your account" : "Welcome back"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isRegister
            ? "Start managing your team's work in minutes."
            : "Log in to your workspace."}
        </p>
      </div>
      <form onSubmit={submit} noValidate className="grid gap-5">
        {props.error && (
          <Alert variant="destructive">
            <AlertDescription>{props.error}</AlertDescription>
          </Alert>
        )}
        {isRegister && (
          <Field label="Name" id="name" error={errors.name?.message}>
            <Input
              id="name"
              autoComplete="name"
              className="h-10"
              {...register("name")}
            />
          </Field>
        )}
        <Field label="Email" id="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            className="h-10"
            {...register("email")}
          />
        </Field>
        <Field label="Password" id="password" error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete={isRegister ? "new-password" : "current-password"}
            className="h-10"
            {...register("password")}
          />
        </Field>
        <Button
          type="submit"
          className="h-[42px] w-full text-sm"
          disabled={isSubmitting}
        >
          {isSubmitting
            ? "Please wait…"
            : isRegister
              ? "Create account"
              : "Log in"}
        </Button>
      </form>
      <p className="text-[13px] text-muted-foreground">
        {isRegister ? "Already have an account? " : "No account? "}
        <Link
          href={switchHref}
          className="font-medium text-ai hover:text-[#4a32b0] hover:underline"
        >
          {isRegister ? "Log in" : "Create one"}
        </Link>
      </p>
    </div>
  );
}

function Field({
  label,
  id,
  error,
  children,
}: {
  label: string;
  id: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-[12.5px]">
        {label}
      </Label>
      {children}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
