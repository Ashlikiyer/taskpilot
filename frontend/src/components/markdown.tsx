import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";

import { MENTION_SCHEME, mentionsToLinks } from "@/lib/mentions";
import { cn } from "@/lib/utils";

/** Mentions use a private scheme; everything else goes through react-markdown's safe filter. */
function urlTransform(url: string): string {
  return url.startsWith(MENTION_SCHEME) ? url : defaultUrlTransform(url);
}

/**
 * Renders user-written markdown safely: raw HTML is dropped, unsafe link
 * protocols (like `javascript:`) are removed, and images are not loaded so a
 * comment can't pull in tracking pixels from other sites.
 */
export function Markdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "text-sm break-words [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-xs [&_h1]:text-base [&_h1]:font-semibold [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1.5 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-2 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_table]:my-2 [&_table]:border-collapse [&_td]:border [&_td]:px-2 [&_th]:border [&_th]:px-2 [&_ul]:list-disc [&_ul]:pl-5 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        disallowedElements={["img"]}
        unwrapDisallowed
        urlTransform={urlTransform}
        components={{
          a: ({ href, children: text }) =>
            href?.startsWith(MENTION_SCHEME) ? (
              <span className="rounded bg-primary/10 px-1 font-medium text-primary no-underline">
                {text}
              </span>
            ) : (
              <a href={href} target="_blank" rel="noopener noreferrer nofollow">
                {text}
              </a>
            ),
        }}
      >
        {mentionsToLinks(children)}
      </ReactMarkdown>
    </div>
  );
}
