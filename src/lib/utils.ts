import { isClickableArticleUrl } from "@/lib/sources/articleUrl";

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "Date not listed";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Date not listed";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** External publisher article URL safe to open in a new tab. */
export function safeArticleHref(url: string | null | undefined): string | null {
  if (!url) return null;
  return isClickableArticleUrl(url) ? url : null;
}
