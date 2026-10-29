"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateTask } from "@/hooks/use-tasks";
import { errorMessage } from "@/lib/api/client";

export function AddTaskInput({
  projectId,
  parentId,
  placeholder = "Add a task and press Enter",
}: {
  projectId: string;
  parentId?: string;
  placeholder?: string;
}) {
  const [title, setTitle] = useState("");
  const createTask = useCreateTask(projectId);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    createTask.mutate(
      { title: trimmed, parent_id: parentId ?? null },
      {
        onSuccess: () => setTitle(""),
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  };

  return (
    <form onSubmit={submit} className="flex gap-2">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={placeholder}
        aria-label={parentId ? "New subtask title" : "New task title"}
        maxLength={200}
        disabled={createTask.isPending}
      />
      <Button
        type="submit"
        variant="outline"
        disabled={!title.trim() || createTask.isPending}
      >
        <PlusIcon />
        Add
      </Button>
    </form>
  );
}
