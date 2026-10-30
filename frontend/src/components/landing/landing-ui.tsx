/** Shared pieces of the landing page, used by the static and interactive sections. */
import { cn } from "@/lib/utils";

export const GITHUB_URL = "https://github.com/Ashlikiyer/taskpilot";
export const DEMO_LOGIN = "/login?demo=1";

export const SECTION = "mx-auto w-full max-w-[1200px] px-6";
export const H2 =
  "text-[clamp(32px,3.8vw,44px)] leading-[1.08] font-semibold tracking-[-0.03em] text-balance";
export const LEAD = "text-base leading-relaxed text-[#55585d]";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span
        aria-hidden
        className="flex size-8 items-center justify-center rounded-[9px] bg-primary text-sm text-primary-foreground"
      >
        ✦
      </span>
      <span className="text-base font-semibold">TaskPilot</span>
    </span>
  );
}

/** Rounded green panel with a white "app window" cropped at its edge. */
export function TexturePanel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "texture-green relative overflow-hidden rounded-[20px]",
        className,
      )}
    >
      {children}
    </div>
  );
}
