import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
      <Link href="/" className="text-2xl font-semibold tracking-tight">
        TaskPilot
      </Link>
      {children}
    </main>
  );
}
