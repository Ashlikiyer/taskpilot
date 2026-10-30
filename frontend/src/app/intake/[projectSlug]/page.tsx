"use client";

import { useParams } from "next/navigation";
import { Suspense } from "react";

import { PublicIntakeForm } from "@/components/intake/public-intake-form";
import { Skeleton } from "@/components/ui/skeleton";

function FormFromUrl() {
  const { projectSlug } = useParams<{ projectSlug: string }>();
  return <PublicIntakeForm slug={projectSlug} />;
}

/** Public request form: anyone with the link can submit, no login needed. */
export default function PublicIntakePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
      <p className="text-lg font-semibold tracking-tight">TaskPilot</p>
      {/* Reading URL params needs a Suspense boundary under Cache Components. */}
      <Suspense
        fallback={<Skeleton className="h-96 w-full max-w-lg" aria-busy />}
      >
        <FormFromUrl />
      </Suspense>
    </main>
  );
}
