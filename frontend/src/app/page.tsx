import { BackendStatus } from "@/components/backend-status";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-start justify-center gap-6 px-4 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">TaskPilot</h1>
      <p className="text-lg text-muted-foreground">
        AI-powered task management for small teams. Create tasks from plain
        sentences, get a daily digest of overdue work, and turn emails and
        spreadsheets into tasks automatically.
      </p>
      <BackendStatus />
    </main>
  );
}
