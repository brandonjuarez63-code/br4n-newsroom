import type { StoryStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STYLES: Record<StoryStatus, string> = {
  CONFIRMED:
    "bg-emerald-500/10 text-emerald-300/95 border-emerald-500/30",
  "HIGH CONFIDENCE":
    "bg-sky-500/10 text-sky-300/95 border-sky-500/30",
  REPORTED:
    "bg-amber-500/10 text-amber-200/95 border-amber-500/30",
  UNCONFIRMED:
    "bg-orange-500/10 text-orange-300/90 border-orange-500/25",
  RUMOR:
    "bg-rose-500/10 text-rose-300/90 border-rose-500/25",
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
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]",
        STYLES[status] || STYLES.REPORTED,
        className
      )}
    >
      {status}
    </span>
  );
}
