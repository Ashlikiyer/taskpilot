import type { Schemas } from "@/lib/api/client";

export type Role = Schemas["MemberRole"];
export type AssignableRole = Schemas["MemberUpdate"]["role"];

const RANK: Record<Role, number> = { viewer: 0, member: 1, admin: 2, owner: 3 };

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
};

export const ASSIGNABLE_ROLES: AssignableRole[] = ["admin", "member", "viewer"];

/**
 * UI convenience only: hides actions the backend would reject anyway.
 * The FastAPI backend is the security boundary.
 */
export function hasRole(role: Role | undefined, min: Role): boolean {
  return role !== undefined && RANK[role] >= RANK[min];
}
