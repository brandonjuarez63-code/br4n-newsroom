import type { StoryStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STYLES: Record<StoryStatus, string> = {
  CONFIRMED: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  "HIGH CONFIDENCE": "bg-sky-500/15 text-sky-300 border-sky-500/40",
  REPORTED: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  UNCONFIRMED: "bg-orange-500/15 text-orange-300 border-orange-500/40",
  RUMOR: "bg-rose-500/15 text-rose-300 border-rose-500/40",
};

export function StatusBadge({ status }: { status: StoryStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide",
        STYLES[status] || STYLES.REPORTED
      )}
    >
      {status}
    </span>
  );
}
