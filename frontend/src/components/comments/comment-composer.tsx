"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Schemas } from "@/lib/api/client";
import { activeMentionQuery, insertMention } from "@/lib/mentions";
import { cn } from "@/lib/utils";

const MAX_SUGGESTIONS = 6;

type Props = {
  members: Schemas["MemberOut"][];
  onSubmit: (body: string) => Promise<unknown>;
  initialValue?: string;
  submitLabel?: string;
  onCancel?: () => void;
  label: string;
};

/**
 * Markdown comment box. Typing `@` suggests workspace members; arrow keys move,
 * Enter or Tab picks, Escape closes the list. Ctrl/Cmd+Enter sends.
 */
export function CommentComposer({
  members,
  onSubmit,
  initialValue = "",
  submitLabel = "Comment",
  onCancel,
  label,
}: Props) {
  const listId = useId();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState(initialValue);
  const [caret, setCaret] = useState(initialValue.length);
  const [active, setActive] = useState(0);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const pendingCaret = useRef<number | null>(null);

  // Restore the caret after inserting a mention.
  useLayoutEffect(() => {
    if (pendingCaret.current !== null && ref.current) {
      ref.current.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }
  }, [text]);

  const mention = activeMentionQuery(text, caret);
  const suggestions =
    mention && mention.start !== dismissedAt
      ? members
          .filter((m) =>
            m.name.toLowerCase().includes(mention.query.toLowerCase()),
          )
          .slice(0, MAX_SUGGESTIONS)
      : [];
  const open = suggestions.length > 0;
  const activeIndex = Math.min(active, suggestions.length - 1);
  const optionId = (index: number) => `${listId}-${index}`;

  const pick = (member: Schemas["MemberOut"]) => {
    if (!mention) return;
    const next = insertMention(
      text,
      mention.start,
      caret,
      member.name,
      member.user_id,
    );
    pendingCaret.current = next.caret;
    setText(next.text);
    setCaret(next.caret);
    setActive(0);
  };

  const submit = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await onSubmit(body);
      setText("");
      setCaret(0);
    } catch {
      // The caller shows the error; keep the text so nothing is lost.
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (open) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        setActive(
          (activeIndex + step + suggestions.length) % suggestions.length,
        );
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        pick(suggestions[activeIndex]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation(); // keep the drawer open
        setDismissedAt(mention?.start ?? null);
        return;
      }
    }
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void submit();
    } else if (event.key === "Escape" && onCancel) {
      event.stopPropagation();
      onCancel();
    }
  };

  const syncCaret = (event: React.SyntheticEvent<HTMLTextAreaElement>) =>
    setCaret(event.currentTarget.selectionStart);

  return (
    <div className="grid gap-2">
      <div className="relative">
        <Textarea
          ref={ref}
          aria-label={label}
          aria-autocomplete="list"
          aria-controls={open ? listId : undefined}
          aria-activedescendant={open ? optionId(activeIndex) : undefined}
          rows={3}
          maxLength={10_000}
          value={text}
          placeholder="Write a comment… Use @ to mention someone."
          onChange={(e) => {
            setText(e.target.value);
            setCaret(e.target.selectionStart);
            setActive(0);
          }}
          onSelect={syncCaret}
          onClick={syncCaret}
          onKeyDown={onKeyDown}
        />
        {open && (
          <ul
            id={listId}
            role="listbox"
            aria-label="Mention a member"
            className="absolute inset-x-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-md border bg-popover p-1 text-sm shadow-md"
          >
            {suggestions.map((member, index) => (
              <li
                key={member.user_id}
                id={optionId(index)}
                role="option"
                aria-selected={index === activeIndex}
                // Keep focus in the textarea while clicking a suggestion.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(member)}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1.5",
                  index === activeIndex && "bg-muted",
                )}
              >
                <span className="truncate">{member.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {member.email}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="sr-only" aria-live="polite">
        {open
          ? `${suggestions.length} members match. Use the arrow keys and Enter to pick.`
          : ""}
      </p>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          Markdown supported · Ctrl+Enter to send
        </span>
        <span className="flex gap-2">
          {onCancel && (
            <Button size="sm" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => void submit()}
            disabled={!text.trim() || sending}
          >
            {sending ? "Sending…" : submitLabel}
          </Button>
        </span>
      </div>
    </div>
  );
}
