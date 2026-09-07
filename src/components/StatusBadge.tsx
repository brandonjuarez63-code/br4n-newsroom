import type { StoryStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Quieter metadata treatment — status reads as editorial label, not dashboard chip. */
const STYLES: Record<StoryStatus, string> = {
  CONFIRMED: "text-emerald-300/75 border-emerald-500/20",
  "HIGH CONFIDENCE": "text-sky-300/75 border-sky-500/20",
  REPORTED: "text-amber-200/75 border-amber-500/20",
  UNCONFIRMED: "text-orange-300/70 border-orange-500/18",
  RUMOR: "text-rose-300/70 border-rose-500/18",
};

export function StatusBadge({
  status,
  className,
}: {
  status: StoryStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border border-newsroom-border/60 bg-transparent px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em]",
        STYLES[status] || STYLES.REPORTED,
        className
      )}
    >
      {status}
    </span>
  );
}
