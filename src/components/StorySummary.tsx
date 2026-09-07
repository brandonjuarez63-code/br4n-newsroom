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
      <h2 className="text-xs font-semibold uppercase tracking-wider text-newsroom-gold">
        Summary
      </h2>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-newsroom-muted">
        {expanded && canExpand ? longSummary : shortSummary}
      </p>
      {canExpand && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-xs font-semibold uppercase tracking-wider text-newsroom-gold hover:underline"
          aria-expanded={expanded}
        >
          {expanded ? "Read less ▲" : "Read more ▼"}
        </button>
      )}
    </div>
  );
}
