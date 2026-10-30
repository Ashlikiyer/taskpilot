"use client";

import { useState } from "react";
import { toast } from "sonner";

import { MappingStep } from "@/components/import/mapping-step";
import { PreviewStep } from "@/components/import/preview-step";
import { ResultStep } from "@/components/import/result-step";
import { UploadStep } from "@/components/import/upload-step";
import { EmptyState } from "@/components/states";
import {
  useImportJob,
  usePreviewImport,
  useRunImport,
  useSaveMapping,
  useSuggestMapping,
  useUploadImport,
} from "@/hooks/use-imports";
import { useProjects } from "@/hooks/use-projects";
import { useCurrentWorkspace } from "@/hooks/use-workspaces";
import { ApiError, errorMessage } from "@/lib/api/client";
import { hasRole } from "@/lib/roles";
import { cn } from "@/lib/utils";

const STEPS = ["Upload", "Map columns", "Preview", "Done"] as const;
type Step = 0 | 1 | 2 | 3;

export default function ImportPage() {
  const { workspace } = useCurrentWorkspace();
  const isAdmin = hasRole(workspace?.role, "admin");
  if (!workspace) return null;
  if (!isAdmin) {
    return (
      <EmptyState
        title="Only admins can import"
        description="Ask an admin or the owner to import task lists into this workspace."
      />
    );
  }
  return <ImportWizard workspaceId={workspace.id} slug={workspace.slug} />;
}

function ImportWizard({
  workspaceId,
  slug,
}: {
  workspaceId: string;
  slug: string;
}) {
  const [step, setStep] = useState<Step>(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [allowDuplicates, setAllowDuplicates] = useState(true);
  const projects = useProjects(workspaceId);
  const job = useImportJob(jobId);
  const upload = useUploadImport(workspaceId);
  const suggest = useSuggestMapping(jobId ?? "");
  const saveMapping = useSaveMapping(jobId ?? "");
  const preview = usePreviewImport(jobId ?? "");
  const runImport = useRunImport(jobId ?? "");

  const runPreview = (nextProject: string | null, nextAllow: boolean) => {
    setProjectId(nextProject);
    setAllowDuplicates(nextAllow);
    if (nextProject)
      preview.mutate({ project_id: nextProject, allow_duplicates: nextAllow });
  };

  const startOver = () => {
    setStep(0);
    setJobId(null);
    setProjectId(null);
    setAllowDuplicates(true);
    [upload, suggest, saveMapping, preview, runImport].forEach((m) =>
      m.reset(),
    );
  };

  const project = projects.data?.find((p) => p.id === projectId);

  return (
    <div className="grid max-w-[1100px] gap-5">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="grid min-w-0 flex-1 gap-1">
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">
            Import tasks
          </h1>
          <p className="truncate text-[13px] text-muted-foreground">
            {job.data
              ? `${job.data.file_name} · ${job.data.total_rows} ${job.data.total_rows === 1 ? "row" : "rows"}${project ? ` · into ${project.name}` : ""}`
              : "Bring tasks over from a spreadsheet export of another tool."}
          </p>
        </div>
        <ol
          className="flex flex-wrap items-center gap-2 text-[12.5px]"
          aria-label="Import steps"
        >
          {STEPS.map((label, index) => (
            <li
              key={label}
              aria-current={index === step ? "step" : undefined}
              className={cn(
                "flex items-center gap-1.5 text-subtle",
                index === step && "font-semibold text-foreground",
                index < step && "text-status-done",
              )}
            >
              {index > 0 && (
                <span aria-hidden className="mr-0.5 h-px w-6 bg-[#d9d9d5]" />
              )}
              <span
                aria-hidden
                className={cn(
                  "flex size-[18px] items-center justify-center rounded-full border border-[#d9d9d5] text-[10px]",
                  index === step &&
                    "border-primary bg-primary text-primary-foreground",
                  index < step && "border-transparent bg-[#e3f3ea]",
                )}
              >
                {index < step ? "✓" : index + 1}
              </span>
              {label}
              {index < step && <span className="sr-only"> (done)</span>}
            </li>
          ))}
        </ol>
      </header>

      {step === 0 && (
        <UploadStep
          job={job.data}
          uploading={upload.isPending}
          error={upload.error}
          onUpload={(file, sheet) =>
            upload.mutate(
              { file, sheet },
              { onSuccess: (uploaded) => setJobId(uploaded.id) },
            )
          }
          onNext={() => {
            setStep(1);
            if (!job.data?.mapping) {
              suggest.mutate(undefined, {
                onError: (error) =>
                  toast.error(
                    error instanceof ApiError && error.code === "AI_DAILY_LIMIT"
                      ? error.message
                      : `The AI couldn't suggest a mapping, so please map the columns yourself. ${errorMessage(error)}`,
                  ),
              });
            }
          }}
        />
      )}

      {step === 1 && job.data && (
        <MappingStep
          // Remount when the AI's suggestion arrives so the form starts from it.
          key={`${job.data.id}-${job.data.mapping ? "mapped" : "empty"}`}
          job={job.data}
          suggesting={suggest.isPending}
          saving={saveMapping.isPending}
          error={saveMapping.error}
          onBack={() => setStep(0)}
          onSave={(mapping) =>
            saveMapping.mutate(mapping, {
              onSuccess: () => {
                setStep(2);
                if (projectId) runPreview(projectId, allowDuplicates);
              },
            })
          }
        />
      )}

      {step === 2 && (
        <PreviewStep
          projects={projects.data ?? []}
          projectId={projectId}
          allowDuplicates={allowDuplicates}
          onOptionsChange={runPreview}
          preview={preview.data}
          previewing={preview.isPending}
          importing={runImport.isPending}
          error={preview.error ?? runImport.error}
          onBack={() => setStep(1)}
          onImport={() =>
            projectId &&
            runImport.mutate(
              { project_id: projectId, allow_duplicates: allowDuplicates },
              { onSuccess: () => setStep(3) },
            )
          }
        />
      )}

      {step === 3 && runImport.data && job.data && (
        <ResultStep
          result={runImport.data}
          headers={job.data.headers}
          fileName={job.data.file_name}
          projectName={project?.name ?? "the project"}
          boardHref={`/w/${slug}/p/${projectId}`}
          onStartOver={startOver}
        />
      )}
    </div>
  );
}
