import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, type Schemas } from "@/lib/api/client";

type Task = Schemas["TaskOut"];
type TaskPage = Schemas["TaskPage"];

export const taskKeys = {
  project: (projectId: string) => ["projects", projectId, "tasks"] as const,
  subtasks: (parentId: string) => ["tasks", parentId, "subtasks"] as const,
  detail: (taskId: string) => ["tasks", taskId] as const,
  activity: (taskId: string) => ["tasks", taskId, "activity"] as const,
};

const isMyTasksQuery = (query: { queryKey: readonly unknown[] }) =>
  query.queryKey[2] === "my-tasks";

/** Open tasks assigned to the current user, grouped by due date (computed by the backend). */
export function useMyTasks(wsId: string | undefined) {
  return useQuery({
    queryKey: ["workspaces", wsId, "my-tasks"],
    queryFn: () => api.get<Schemas["MyTasks"]>(`/workspaces/${wsId}/my-tasks`),
    enabled: Boolean(wsId),
  });
}

/** Tasks and projects matching `text` anywhere in the workspace (Ctrl/Cmd+K). */
export function useWorkspaceSearch(wsId: string, text: string) {
  const q = text.trim();
  return useQuery({
    queryKey: ["workspaces", wsId, "search", q],
    queryFn: () =>
      api.get<Schemas["SearchResults"]>(
        `/workspaces/${wsId}/search?q=${encodeURIComponent(q)}`,
      ),
    enabled: q.length > 0,
    placeholderData: (previous) => previous,
    staleTime: 10_000,
  });
}

/** Top-level tasks of a project, in board order. */
export function useProjectTasks(projectId: string | undefined) {
  return useQuery({
    queryKey: taskKeys.project(projectId ?? ""),
    queryFn: () =>
      api.get<TaskPage>(
        `/projects/${projectId}/tasks?sort=position&page_size=100`,
      ),
    enabled: Boolean(projectId),
  });
}

export function useSubtasks(task: Task | undefined) {
  return useQuery({
    queryKey: taskKeys.subtasks(task?.id ?? ""),
    queryFn: () =>
      api.get<TaskPage>(
        `/projects/${task?.project_id}/tasks?parent_id=${task?.id}&sort=position&page_size=100`,
      ),
    enabled: Boolean(task && task.parent_id === null),
  });
}

export function useTask(taskId: string | null) {
  return useQuery({
    queryKey: taskKeys.detail(taskId ?? ""),
    queryFn: () => api.get<Task>(`/tasks/${taskId}`),
    enabled: Boolean(taskId),
  });
}

export function useTaskActivity(taskId: string | undefined) {
  return useQuery({
    queryKey: taskKeys.activity(taskId ?? ""),
    queryFn: () =>
      api.get<Schemas["ActivityOut"][]>(`/tasks/${taskId}/activity`),
    enabled: Boolean(taskId),
  });
}

/** Refresh everything a task change can affect: the board, its parent and its history. */
function useSyncTask() {
  const queryClient = useQueryClient();
  return (task: Pick<Task, "id" | "project_id" | "parent_id">) =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: taskKeys.project(task.project_id),
      }),
      queryClient.invalidateQueries({ queryKey: taskKeys.activity(task.id) }),
      task.parent_id &&
        queryClient.invalidateQueries({ queryKey: ["tasks", task.parent_id] }),
      queryClient.invalidateQueries({ predicate: isMyTasksQuery }),
    ]);
}

export function useCreateTask(projectId: string) {
  const sync = useSyncTask();
  return useMutation({
    mutationFn: (data: Schemas["TaskCreate"]) =>
      api.post<Task>(`/projects/${projectId}/tasks`, data),
    onSuccess: sync,
  });
}

export function useUpdateTask(taskId: string) {
  const queryClient = useQueryClient();
  const sync = useSyncTask();
  return useMutation({
    mutationFn: (data: Schemas["TaskUpdate"]) =>
      api.patch<Task>(`/tasks/${taskId}`, data),
    onSuccess: (task) => {
      queryClient.setQueryData(taskKeys.detail(task.id), task);
      return sync(task);
    },
  });
}

export function useDeleteTask(
  task: Pick<Task, "id" | "project_id" | "parent_id">,
) {
  const queryClient = useQueryClient();
  const sync = useSyncTask();
  return useMutation({
    mutationFn: () => api.delete(`/tasks/${task.id}`),
    onSuccess: () => {
      queryClient.removeQueries({
        queryKey: taskKeys.detail(task.id),
        exact: true,
      });
      return sync(task);
    },
  });
}

export function useLabels(wsId: string | undefined) {
  return useQuery({
    queryKey: ["workspaces", wsId, "labels"],
    queryFn: () => api.get<Schemas["LabelOut"][]>(`/workspaces/${wsId}/labels`),
    enabled: Boolean(wsId),
  });
}

export function useCreateLabel(wsId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Schemas["LabelCreate"]) =>
      api.post<Schemas["LabelOut"]>(`/workspaces/${wsId}/labels`, data),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["workspaces", wsId, "labels"],
      }),
  });
}

type MoveVars = {
  task: Task;
  status: Schemas["TaskStatus"];
  before?: Task;
  after?: Task;
  /** The optimistic position, already written to the board cache. */
  position: number;
};

/**
 * Move a card on the board. The board cache is updated immediately (so the card
 * doesn't jump back while the request is in flight) and restored if the move fails.
 */
export function useMoveTask(projectId: string) {
  const queryClient = useQueryClient();
  const key = taskKeys.project(projectId);
  const mutation = useMutation({
    mutationFn: ({ task, status, before, after }: MoveVars) =>
      api.post<Task>(`/tasks/${task.id}/move`, {
        status,
        before_id: before?.id ?? null,
        after_id: after?.id ?? null,
      }),
    onSettled: (_data, _error, { task }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: key }),
        queryClient.invalidateQueries({ queryKey: taskKeys.detail(task.id) }),
        queryClient.invalidateQueries({ queryKey: taskKeys.activity(task.id) }),
        queryClient.invalidateQueries({ predicate: isMyTasksQuery }),
      ]),
  });

  return (vars: MoveVars, onError: (error: unknown) => void) => {
    const snapshot = queryClient.getQueryData<TaskPage>(key);
    void queryClient.cancelQueries({ queryKey: key });
    queryClient.setQueryData<TaskPage>(
      key,
      (page) =>
        page && {
          ...page,
          items: page.items.map((t) =>
            t.id === vars.task.id
              ? { ...t, status: vars.status, position: vars.position }
              : t,
          ),
        },
    );
    mutation.mutate(vars, {
      onError: (error) => {
        queryClient.setQueryData(key, snapshot);
        onError(error);
      },
    });
  };
}

/** One page of the list view; shares the project prefix so task changes refresh it. */
export function useTaskListPage(projectId: string, apiQuery: string) {
  return useQuery({
    queryKey: [...taskKeys.project(projectId), "list", apiQuery],
    queryFn: () =>
      api.get<TaskPage>(`/projects/${projectId}/tasks?${apiQuery}`),
    placeholderData: (previous) => previous,
    enabled: Boolean(projectId),
  });
}
