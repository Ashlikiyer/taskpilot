"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRemoveMember, useUpdateMemberRole } from "@/hooks/use-workspaces";
import { errorMessage, type Schemas } from "@/lib/api/client";
import {
  ASSIGNABLE_ROLES,
  ROLE_LABELS,
  type AssignableRole,
} from "@/lib/roles";

type Member = Schemas["MemberOut"];

const roleItems = ASSIGNABLE_ROLES.map((role) => ({
  value: role,
  label: ROLE_LABELS[role],
}));

export function MemberTable({
  workspaceId,
  members,
  canManage,
  currentUserId,
}: {
  workspaceId: string;
  members: Member[];
  canManage: boolean;
  currentUserId: string | undefined;
}) {
  const updateRole = useUpdateMemberRole(workspaceId);
  const removeMember = useRemoveMember(workspaceId);
  const [removing, setRemoving] = useState<Member | null>(null);

  const changeRole = (member: Member, role: AssignableRole) =>
    updateRole.mutate(
      { userId: member.user_id, role },
      {
        onSuccess: () =>
          toast.success(`${member.name} is now ${ROLE_LABELS[role]}`),
        onError: (error) => toast.error(errorMessage(error)),
      },
    );

  const confirmRemove = () => {
    if (!removing) return;
    removeMember.mutate(removing.user_id, {
      onSuccess: () => toast.success(`${removing.name} was removed`),
      onError: (error) => toast.error(errorMessage(error)),
      onSettled: () => setRemoving(null),
    });
  };

  return (
    <>
      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="hidden sm:table-cell">Joined</TableHead>
              {canManage && (
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => {
              const editable = canManage && member.role !== "owner";
              return (
                <TableRow key={member.user_id}>
                  <TableCell>
                    <p className="font-medium">
                      {member.name}
                      {member.user_id === currentUserId && (
                        <span className="text-muted-foreground"> (you)</span>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {member.email}
                    </p>
                  </TableCell>
                  <TableCell>
                    {canManage && member.role !== "owner" ? (
                      <Select
                        items={roleItems}
                        value={member.role}
                        onValueChange={(value) =>
                          value &&
                          value !== member.role &&
                          changeRole(member, value)
                        }
                      >
                        <SelectTrigger
                          className="w-28"
                          aria-label={`Role for ${member.name}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {roleItems.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge
                        variant={
                          member.role === "owner" ? "default" : "secondary"
                        }
                      >
                        {ROLE_LABELS[member.role]}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                    {new Date(member.joined_at).toLocaleDateString()}
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      {editable && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRemoving(member)}
                        >
                          Remove
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {removing?.name}?</DialogTitle>
            <DialogDescription>
              They&apos;ll lose access to this workspace. You can invite them
              again later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              variant="destructive"
              onClick={confirmRemove}
              disabled={removeMember.isPending}
            >
              {removeMember.isPending ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
