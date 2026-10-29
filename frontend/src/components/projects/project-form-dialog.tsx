"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMe } from "@/hooks/use-auth";
import { useCreateProject, useUpdateProject } from "@/hooks/use-projects";
import { useMembers } from "@/hooks/use-workspaces";
import { errorMessage, type Schemas } from "@/lib/api/client";
import { DEFAULT_PROJECT_COLOR, PROJECT_COLORS } from "@/lib/project-colors";
import { cn } from "@/lib/utils";

const schema = z.object({
  name: z.string().trim().min(1, "Enter a project name").max(100),
  description: z.string().trim().max(2000, "Keep it under 2,000 characters"),
  color: z.string().regex(/^#[0-9a-f]{6}$/),
  memberIds: z.array(z.string()),
});

type Values = z.infer<typeof schema>;

type Props = {
  workspace: Schemas["WorkspaceOut"];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit this project; omit to create a new one. */
  project?: Schemas["ProjectOut"];
};

export function ProjectFormDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Remount on open so the form starts from the current project values. */}
        {props.open && <ProjectForm {...props} />}
      </DialogContent>
    </Dialog>
  );
}

function ProjectForm({ workspace, project, onOpenChange }: Props) {
  const router = useRouter();
  const me = useMe();
  const members = useMembers(workspace.id);
  const createProject = useCreateProject(workspace.id);
  const updateProject = useUpdateProject(project?.id ?? "");
  const mutation = project ? updateProject : createProject;
  const [submitError, setSubmitError] = useState<string>();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: project?.name ?? "",
      description: project?.description ?? "",
      color: project?.color ?? DEFAULT_PROJECT_COLOR,
      memberIds: project?.member_ids ?? [],
    },
  });

  const submit = handleSubmit(async ({ memberIds, description, ...rest }) => {
    setSubmitError(undefined);
    const body = {
      ...rest,
      description: description || null,
      member_ids: memberIds,
    };
    try {
      const saved = project
        ? await updateProject.mutateAsync(body)
        : await createProject.mutateAsync(body);
      toast.success(project ? "Project updated" : "Project created");
      onOpenChange(false);
      if (!project) router.push(`/w/${workspace.slug}/p/${saved.id}`);
    } catch (error) {
      setSubmitError(errorMessage(error));
    }
  });

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{project ? "Edit project" : "New project"}</DialogTitle>
        <DialogDescription>
          {project
            ? "Change the project's details and who works on it."
            : "Group related tasks and choose who works on them."}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-2">
        <Label htmlFor="project-name">Name</Label>
        <Input id="project-name" autoFocus {...register("name")} />
        {errors.name && (
          <p role="alert" className="text-sm text-destructive">
            {errors.name.message}
          </p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="project-description">Description (optional)</Label>
        <Textarea
          id="project-description"
          rows={3}
          {...register("description")}
        />
        {errors.description && (
          <p role="alert" className="text-sm text-destructive">
            {errors.description.message}
          </p>
        )}
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Color</legend>
        <Controller
          control={control}
          name="color"
          render={({ field }) => (
            <div className="flex flex-wrap gap-2">
              {PROJECT_COLORS.map((color) => (
                <label key={color.value} title={color.name}>
                  <input
                    type="radio"
                    name={field.name}
                    value={color.value}
                    checked={field.value === color.value}
                    onChange={() => field.onChange(color.value)}
                    className="peer sr-only"
                  />
                  <span className="sr-only">{color.name}</span>
                  <span
                    aria-hidden
                    style={{ backgroundColor: color.value }}
                    className={cn(
                      "block size-7 cursor-pointer rounded-full ring-offset-2 ring-offset-background peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
                      field.value === color.value && "ring-2 ring-foreground",
                    )}
                  />
                </label>
              ))}
            </div>
          )}
        />
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Members</legend>
        {members.isPending && (
          <p className="text-sm text-muted-foreground">Loading members…</p>
        )}
        {members.isError && (
          <p className="text-sm text-destructive">
            Couldn&apos;t load members.
          </p>
        )}
        {members.data && (
          <Controller
            control={control}
            name="memberIds"
            render={({ field }) => (
              <ul className="grid max-h-48 gap-2 overflow-y-auto rounded-lg border p-3">
                {members.data.map((member) => {
                  // A new project always includes its creator (the backend adds them).
                  const isCreator = !project && member.user_id === me.data?.id;
                  const checked =
                    isCreator || field.value.includes(member.user_id);
                  const id = `project-member-${member.user_id}`;
                  return (
                    <li
                      key={member.user_id}
                      className="flex items-center gap-2"
                    >
                      <Checkbox
                        id={id}
                        aria-labelledby={`${id}-label`}
                        checked={checked}
                        disabled={isCreator}
                        onCheckedChange={(next) =>
                          field.onChange(
                            next
                              ? [...field.value, member.user_id]
                              : field.value.filter(
                                  (uid) => uid !== member.user_id,
                                ),
                          )
                        }
                      />
                      <Label
                        id={`${id}-label`}
                        htmlFor={id}
                        className="font-normal"
                      >
                        {member.name}
                        {isCreator && (
                          <>
                            {" "}
                            <span className="text-muted-foreground">(you)</span>
                          </>
                        )}
                      </Label>
                    </li>
                  );
                })}
              </ul>
            )}
          />
        )}
      </fieldset>

      {submitError && (
        <p role="alert" className="text-sm text-destructive">
          {submitError}
        </p>
      )}
      <DialogFooter>
        <Button type="submit" disabled={isSubmitting || mutation.isPending}>
          {isSubmitting
            ? "Saving…"
            : project
              ? "Save changes"
              : "Create project"}
        </Button>
      </DialogFooter>
    </form>
  );
}
