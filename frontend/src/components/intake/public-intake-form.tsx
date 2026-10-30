"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleCheckIcon } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useIntakeForm, useSubmitIntakeForm } from "@/hooks/use-public-intake";
import { ApiError } from "@/lib/api/client";

const schema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(100),
  email: z.email("Enter a valid email").max(320),
  title: z.string().trim().min(1, "Say briefly what you need").max(200),
  details: z.string().trim().max(5000, "Keep it under 5,000 characters"),
  website: z.string().max(200), // honeypot: hidden from people
});

type Values = z.infer<typeof schema>;

const EMPTY: Values = {
  name: "",
  email: "",
  title: "",
  details: "",
  website: "",
};

/** The public request form: no login, accessible, and clear about what happens next. */
export function PublicIntakeForm({ slug }: { slug: string }) {
  const info = useIntakeForm(slug);
  const submit = useSubmitIntakeForm(slug);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: EMPTY });

  if (info.isPending) {
    return <Skeleton className="h-96 w-full max-w-lg" aria-busy />;
  }
  if (info.isError) {
    const missing = info.error instanceof ApiError && info.error.status === 404;
    return (
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>
            <h1>
              {missing ? "This form isn't available" : "Something went wrong"}
            </h1>
          </CardTitle>
          <CardDescription>
            {missing
              ? "The link may be wrong, or the team has turned this form off."
              : "We couldn't load the form. Please try again in a moment."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (submit.isSuccess) {
    return (
      <Card className="w-full max-w-lg" role="status">
        <CardHeader>
          <CardTitle>
            <h1 className="flex items-center gap-2">
              <CircleCheckIcon
                className="size-5 text-emerald-600"
                aria-hidden
              />
              Request received
            </h1>
          </CardTitle>
          <CardDescription>
            Thanks! The {info.data.project_name} team at{" "}
            {info.data.workspace_name} will review it.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button
            variant="outline"
            onClick={() => {
              reset(EMPTY);
              submit.reset();
            }}
          >
            Send another request
          </Button>
        </CardFooter>
      </Card>
    );
  }

  const failure =
    submit.error instanceof ApiError && submit.error.status === 429
      ? "You've sent a lot of requests. Please try again in an hour."
      : submit.isError
        ? "We couldn't send your request. Please try again."
        : null;

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>
          {/* CardTitle is a <div>; the page needs a real heading for screen readers. */}
          <h1 className="text-xl">
            Send a request to {info.data.project_name}
          </h1>
        </CardTitle>
        <CardDescription>
          {info.data.workspace_name} will review your request. No account
          needed.
        </CardDescription>
      </CardHeader>
      <form
        noValidate
        onSubmit={handleSubmit(async (values) => {
          await submit.mutateAsync(values).catch(() => undefined);
        })}
      >
        <CardContent className="grid gap-4">
          {failure && (
            <Alert variant="destructive">
              <AlertDescription>{failure}</AlertDescription>
            </Alert>
          )}
          <Field
            id="intake-name"
            label="Your name"
            error={errors.name?.message}
          >
            <Input id="intake-name" autoComplete="name" {...register("name")} />
          </Field>
          <Field id="intake-email" label="Email" error={errors.email?.message}>
            <Input
              id="intake-email"
              type="email"
              autoComplete="email"
              {...register("email")}
            />
          </Field>
          <Field
            id="intake-title"
            label="What do you need?"
            error={errors.title?.message}
          >
            <Input id="intake-title" maxLength={200} {...register("title")} />
          </Field>
          <Field
            id="intake-details"
            label="Details (optional)"
            error={errors.details?.message}
          >
            <Textarea id="intake-details" rows={5} {...register("details")} />
          </Field>
          {/* Honeypot: off-screen and skipped by keyboard and screen readers. */}
          <div
            aria-hidden
            className="absolute -left-[10000px] h-px w-px overflow-hidden"
          >
            <label htmlFor="intake-website">Website</label>
            <input
              id="intake-website"
              tabIndex={-1}
              autoComplete="off"
              {...register("website")}
            />
          </div>
        </CardContent>
        <CardFooter className="mt-6">
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Sending…" : "Send request"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
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
