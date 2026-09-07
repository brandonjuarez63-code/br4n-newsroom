import Link from "next/link";
import { cn } from "@/lib/utils";

/** Primary publication masthead: THE NEWSROOM / by BR4N */
export function BrandMark({
  href = "/",
  size = "lg",
  className,
}: {
  href?: string | null;
  size?: "sm" | "lg";
  className?: string;
}) {
  const titleClass =
    size === "lg"
      ? "text-3xl font-bold tracking-[0.04em] text-white md:text-4xl"
      : "text-xl font-bold tracking-[0.04em] text-white";
  const byClass =
    size === "lg"
      ? "mt-1 text-[11px] font-medium uppercase tracking-[0.28em] text-newsroom-muted md:text-xs"
      : "mt-0.5 text-[10px] font-medium uppercase tracking-[0.24em] text-newsroom-muted";

  const mark = (
    <div className={cn("select-none", className)}>
      <p className={titleClass}>THE NEWSROOM</p>
      <p className={byClass}>by BR4N</p>
    </div>
  );

  if (!href) return mark;
  return (
    <Link href={href} className="block outline-none focus-visible:ring-1 focus-visible:ring-newsroom-gold/50">
      {mark}
    </Link>
  );
}
