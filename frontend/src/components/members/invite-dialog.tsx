"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateInvite } from "@/hooks/use-workspaces";
import { errorMessage, type Schemas } from "@/lib/api/client";
import { ASSIGNABLE_ROLES, ROLE_LABELS } from "@/lib/roles";

const schema = z.object({
  email: z.email("Enter a valid email").max(320),
  role: z.enum(["admin", "member", "viewer"]),
});

const roleItems = ASSIGNABLE_ROLES.map((role) => ({
  value: role,
  label: ROLE_LABELS[role],
}));

export function InviteDialog({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false);
  const [invite, setInvite] = useState<Schemas["InviteOut"] | null>(null);
  const [copied, setCopied] = useState(false);
  const createInvite = useCreateInvite(workspaceId);
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", role: "member" },
  });

  const startOver = () => {
    setInvite(null);
    setCopied(false);
    createInvite.reset();
    reset();
  };

  const submit = handleSubmit(async (values) => {
    const result = await createInvite.mutateAsync(values).catch(() => null);
    if (result) setInvite(result);
  });

  const copy = async () => {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.invite_url);
      setCopied(true);
      toast.success("Invite link copied");
    } catch {
      toast.error("Couldn't copy. Select the link and copy it manually.");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) startOver();
      }}
    >
      <DialogTrigger render={<Button />}>Invite member</DialogTrigger>
      <DialogContent>
        {invite ? (
          <div className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Share this invite link</DialogTitle>
              <DialogDescription>
                Send it to {invite.email}. It works once and expires on{" "}
                {new Date(invite.expires_at).toLocaleDateString()}.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2">
              <Input
                readOnly
                value={invite.invite_url}
                aria-label="Invite link"
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={copy}
                aria-label="Copy invite link"
              >
                {copied ? <CheckIcon /> : <CopyIcon />}
              </Button>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={startOver}>
                Invite another
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Invite a member</DialogTitle>
              <DialogDescription>
                You&apos;ll get a link to share. It&apos;s valid for 7 days.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                autoFocus
                {...register("email")}
              />
              {errors.email && (
                <p role="alert" className="text-sm text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="invite-role">Role</Label>
              <Controller
                control={control}
                name="role"
                render={({ field }) => (
                  <Select
                    items={roleItems}
                    value={field.value}
                    onValueChange={(value) => value && field.onChange(value)}
                  >
                    <SelectTrigger id="invite-role" className="w-full">
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
                )}
              />
            </div>
            {createInvite.isError && (
              <p role="alert" className="text-sm text-destructive">
                {errorMessage(createInvite.error)}
              </p>
            )}
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating link…" : "Create invite link"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
