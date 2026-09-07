"use client";

import { useState } from "react";

export function StorySummary({
  shortSummary,
  longSummary,
}: {
  shortSummary: string;
  longSummary: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const canExpand =
    longSummary.trim().length > 0 &&
    longSummary.trim() !== shortSummary.trim() &&
    longSummary.trim().length > shortSummary.trim().length + 40;

  return (
    <div>
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-newsroom-gold">
        Summary
      </h2>
      <p className="mt-2 text-[15px] leading-relaxed text-white/85">
        {expanded && canExpand ? longSummary : shortSummary}
      </p>
      {canExpand && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2.5 text-xs font-semibold tracking-wide text-newsroom-gold transition-colors hover:text-newsroom-gold/80"
          aria-expanded={expanded}
        >
          {expanded ? "Read less" : "Read more"}
        </button>
      )}
    </div>
  );
}
