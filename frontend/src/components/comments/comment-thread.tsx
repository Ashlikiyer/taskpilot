"use client";

import { useState } from "react";
import { toast } from "sonner";

import {
  SUMMARY_MIN_COMMENTS,
  ThreadSummary,
} from "@/components/ai/thread-summary";
import { CommentComposer } from "@/components/comments/comment-composer";
import { Markdown } from "@/components/markdown";
import { ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useComments,
  useCreateComment,
  useDeleteComment,
  useUpdateComment,
} from "@/hooks/use-comments";
import { errorMessage, type Schemas } from "@/lib/api/client";
import { timeAgo } from "@/lib/tasks";

type Props = {
  taskId: string;
  members: Schemas["MemberOut"][];
  currentUserId: string | undefined;
  /** False in archived projects: the thread stays readable but can't change. */
  canComment: boolean;
  /** AI features are for members and above (not viewers). */
  canUseAI: boolean;
};

export function CommentThread({
  taskId,
  members,
  currentUserId,
  canComment,
  canUseAI,
}: Props) {
  const comments = useComments(taskId);
  const createComment = useCreateComment(taskId);

  const send = (body: string) =>
    createComment.mutateAsync(body).catch((error: unknown) => {
      toast.error(errorMessage(error));
      throw error;
    });

  return (
    <section aria-labelledby="comments-heading" className="grid gap-3">
      <h3 id="comments-heading" className="text-sm font-medium">
        Comments
        {comments.data && comments.data.length > 0 && (
          <span className="ml-2 text-muted-foreground">
            {comments.data.length}
          </span>
        )}
      </h3>
      {canUseAI &&
        comments.data &&
        comments.data.length >= SUMMARY_MIN_COMMENTS && (
          <ThreadSummary
            // A new key whenever the thread changes, so a stale summary is dropped.
            key={comments.data
              .map((c) => `${c.id}:${c.edited_at ?? ""}`)
              .join(",")}
            taskId={taskId}
          />
        )}
      {comments.isPending && <Skeleton className="h-16" />}
      {comments.isError && (
        <ErrorState
          message="We couldn't load comments."
          onRetry={() => comments.refetch()}
        />
      )}
      {comments.data?.length === 0 && (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      )}
      <ol className="grid gap-4">
        {comments.data?.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            taskId={taskId}
            members={members}
            isMine={comment.author_id === currentUserId}
            canChange={canComment}
          />
        ))}
      </ol>
      {canComment && (
        <CommentComposer
          label="New comment"
          members={members}
          onSubmit={send}
        />
      )}
    </section>
  );
}

function CommentItem({
  comment,
  taskId,
  members,
  isMine,
  canChange,
}: {
  comment: Schemas["CommentOut"];
  taskId: string;
  members: Schemas["MemberOut"][];
  isMine: boolean;
  canChange: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const updateComment = useUpdateComment(taskId);
  const deleteComment = useDeleteComment(taskId);

  return (
    <li className="grid gap-1">
      <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className="font-medium">
          {comment.author_name ?? "Former member"}
        </span>
        <time
          dateTime={comment.created_at}
          className="text-xs text-muted-foreground"
        >
          {timeAgo(comment.created_at)}
        </time>
        {comment.edited_at && (
          <span className="text-xs text-muted-foreground">(edited)</span>
        )}
        {isMine && canChange && !editing && (
          <span className="ml-auto flex gap-1">
            {confirmDelete ? (
              <>
                <span className="text-xs text-muted-foreground">Delete?</span>
                <Button
                  size="xs"
                  variant="destructive"
                  disabled={deleteComment.isPending}
                  onClick={() =>
                    deleteComment.mutate(comment.id, {
                      onError: (error) => toast.error(errorMessage(error)),
                    })
                  }
                >
                  Delete
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => setConfirmDelete(false)}
                >
                  Keep
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => setEditing(true)}
                >
                  Edit
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete
                </Button>
              </>
            )}
          </span>
        )}
      </div>
      {editing ? (
        <CommentComposer
          label="Edit comment"
          members={members}
          initialValue={comment.body}
          submitLabel="Save"
          onCancel={() => setEditing(false)}
          onSubmit={(body) =>
            updateComment
              .mutateAsync({ id: comment.id, body })
              .then(() => setEditing(false))
              .catch((error: unknown) => {
                toast.error(errorMessage(error));
                throw error;
              })
          }
        />
      ) : (
        <Markdown>{comment.body}</Markdown>
      )}
    </li>
  );
}
