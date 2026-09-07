import type { StoryStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STYLES: Record<StoryStatus, string> = {
  CONFIRMED:
    "bg-emerald-500/[0.08] text-emerald-300/90 border-emerald-500/25",
  "HIGH CONFIDENCE":
    "bg-sky-500/[0.08] text-sky-300/90 border-sky-500/25",
  REPORTED:
    "bg-amber-500/[0.08] text-amber-200/90 border-amber-500/25",
  UNCONFIRMED:
    "bg-orange-500/[0.08] text-orange-300/85 border-orange-500/20",
  RUMOR:
    "bg-rose-500/[0.08] text-rose-300/85 border-rose-500/20",
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
        "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.05em]",
        STYLES[status] || STYLES.REPORTED,
        className
      )}
    >
      {status}
    </span>
  );
}
