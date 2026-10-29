"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateWorkspace } from "@/hooks/use-workspaces";
import { errorMessage } from "@/lib/api/client";

const schema = z.object({
  name: z.string().trim().min(1, "Enter a workspace name").max(100),
});

export function CreateWorkspaceDialog({
  trigger = "Create workspace",
}: {
  trigger?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const createWorkspace = useCreateWorkspace();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: "" },
  });

  const submit = handleSubmit(async (values) => {
    const workspace = await createWorkspace
      .mutateAsync(values)
      .catch(() => null);
    if (workspace) {
      setOpen(false);
      reset();
      router.push(`/w/${workspace.slug}`);
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) createWorkspace.reset();
      }}
    >
      <DialogTrigger render={<Button />}>{trigger}</DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Create a workspace</DialogTitle>
            <DialogDescription>
              A workspace holds your team, projects and tasks. You&apos;ll be
              its owner.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="workspace-name">Name</Label>
            <Input
              id="workspace-name"
              placeholder="Acme Marketing"
              autoFocus
              {...register("name")}
            />
            {errors.name && (
              <p role="alert" className="text-sm text-destructive">
                {errors.name.message}
              </p>
            )}
            {createWorkspace.isError && (
              <p role="alert" className="text-sm text-destructive">
                {errorMessage(createWorkspace.error)}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create workspace"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
