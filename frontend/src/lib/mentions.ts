/**
 * Mentions are stored as `@[Display Name](user-id)` (see backend app/services/mentions.py).
 * The composer inserts them; the renderer turns them into chips.
 */

export const MENTION = /@\[([^\]\n]{1,100})\]\(([0-9a-fA-F-]{36})\)/g;
export const MENTION_SCHEME = "mention:";

export function mentionToken(name: string, userId: string): string {
  return `@[${name.replace(/[\]\n]/g, "")}](${userId})`;
}

/** Turn mention tokens into links with a private scheme the renderer recognises. */
export function mentionsToLinks(body: string): string {
  return body.replace(
    MENTION,
    (_, name: string, id: string) => `[@${name}](${MENTION_SCHEME}${id})`,
  );
}

/**
 * If the caret is right after an `@word` being typed, return where the `@` is
 * and the text typed so far, so the composer can suggest members.
 */
export function activeMentionQuery(
  text: string,
  caret: number,
): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const match = /(^|\s)@([^\s@[\]()]{0,30})$/.exec(before);
  if (!match) return null;
  return { start: caret - match[2].length - 1, query: match[2] };
}

/** Replace the `@query` being typed with a mention token followed by a space. */
export function insertMention(
  text: string,
  start: number,
  caret: number,
  name: string,
  userId: string,
): { text: string; caret: number } {
  const token = `${mentionToken(name, userId)} `;
  return {
    text: text.slice(0, start) + token + text.slice(caret),
    caret: start + token.length,
  };
}
