"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">
          {isRegister ? "Create your account" : "Log in to TaskPilot"}
        </CardTitle>
        <CardDescription>
          {isRegister
            ? "Start managing your team's work in minutes."
            : "Welcome back. Enter your details to continue."}
        </CardDescription>
      </CardHeader>
      <form onSubmit={submit} noValidate>
        <CardContent className="grid gap-4">
          {props.error && (
            <Alert variant="destructive">
              <AlertDescription>{props.error}</AlertDescription>
            </Alert>
          )}
          {isRegister && (
            <Field label="Name" id="name" error={errors.name?.message}>
              <Input id="name" autoComplete="name" {...register("name")} />
            </Field>
          )}
          <Field label="Email" id="email" error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              {...register("email")}
            />
          </Field>
          <Field
            label="Password"
            id="password"
            error={errors.password?.message}
          >
            <Input
              id="password"
              type="password"
              autoComplete={isRegister ? "new-password" : "current-password"}
              {...register("password")}
            />
          </Field>
        </CardContent>
        <CardFooter className="mt-6 flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting
              ? "Please wait…"
              : isRegister
                ? "Create account"
                : "Log in"}
          </Button>
          <p className="text-sm text-muted-foreground">
            {isRegister ? "Already have an account? " : "New to TaskPilot? "}
            <Link
              href={switchHref}
              className="font-medium text-foreground underline"
            >
              {isRegister ? "Log in" : "Create an account"}
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
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
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
