/**
 * Only allow redirects to paths on this site (blocks `//evil.com` and
 * `https://evil.com` in `?next=`), falling back to the workspace picker.
 */
export function safeRedirect(
  next: string | null | undefined,
  fallback = "/w",
): string {
  if (
    !next ||
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.startsWith("/\\")
  ) {
    return fallback;
  }
  return next;
}
