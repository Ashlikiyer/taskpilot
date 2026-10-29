import { RequireAuth } from "@/components/auth/require-auth";

export default function WorkspacesLayout({ children }: LayoutProps<"/w">) {
  return <RequireAuth>{children}</RequireAuth>;
}
