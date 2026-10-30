import Link from "next/link";

/** Sign in and register: the form on the left, what TaskPilot does on the right. */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-1">
      <main className="flex flex-1 flex-col px-6 py-8 sm:px-14 sm:py-10">
        <Link
          href="/"
          className="flex w-fit items-center gap-2.5 text-[15px] font-semibold"
        >
          <span
            aria-hidden
            className="flex size-[26px] items-center justify-center rounded-[7px] bg-primary text-[13px] text-primary-foreground"
          >
            ✦
          </span>
          TaskPilot
        </Link>
        <div className="my-auto w-full max-w-[360px] py-10">{children}</div>
        <p className="text-xs text-subtle">
          © 2026 TaskPilot · Portfolio build
        </p>
      </main>
      <AuthShowcase />
    </div>
  );
}

function AuthShowcase() {
  return (
    <aside
      aria-label="How quick-add works"
      className="hidden w-[44%] max-w-[560px] flex-col justify-center gap-6 border-l border-[#e3dcfb] bg-ai-soft p-14 lg:flex"
    >
      <p className="font-mono text-[11.5px] tracking-[0.04em] text-ai">
        QUICK-ADD FROM A SENTENCE
      </p>
      <p className="rounded-[10px] border border-ai-border bg-card px-4 py-3.5 text-[14.5px] leading-normal">
        Ask Mark to send the Acme invoice by Friday, high priority
      </p>
      <div className="grid gap-3 rounded-[10px] border border-ai-border bg-card p-4">
        <p className="text-[15px] font-semibold">Send Acme invoice</p>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-md border border-[#e8e8e4] bg-secondary px-2 py-0.5">
            Mark Reyes
          </span>
          <span className="rounded-md border border-[#e8e8e4] bg-secondary px-2 py-0.5">
            Friday
          </span>
          <span className="rounded-md border border-[#f5dcc2] bg-priority-high-soft px-2 py-0.5 text-priority-high">
            High
          </span>
        </div>
      </div>
      <p className="text-[22px] leading-snug font-medium tracking-[-0.01em] text-pretty text-ai-ink">
        The AI drafts the task. You review it, then save.
      </p>
    </aside>
  );
}
