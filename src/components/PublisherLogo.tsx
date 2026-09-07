"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { publisherLogoSrc, resolvePublisher, type PublisherInfo } from "@/lib/publishers";

function InitialsBadge({
  initials,
  className,
  title,
}: {
  initials: string;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md border border-newsroom-border bg-newsroom-panel font-semibold uppercase tracking-tight text-newsroom-muted",
        className
      )}
    >
      {initials.slice(0, 3)}
    </span>
  );
}

export function PublisherLogo({
  name,
  url,
  size = "sm",
  className,
}: {
  name?: string | null;
  url?: string | null;
  size?: "xs" | "sm" | "md";
  className?: string;
}) {
  const info: PublisherInfo = resolvePublisher(name, url);
  const src = publisherLogoSrc(info);
  const [failed, setFailed] = useState(false);

  const box =
    size === "xs"
      ? "h-4 w-4 text-[8px]"
      : size === "md"
        ? "h-6 w-6 text-[10px]"
        : "h-5 w-5 text-[9px]";

  if (!src || failed) {
    return (
      <InitialsBadge
        initials={info.initials}
        title={info.name}
        className={cn(box, className)}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      title={info.name}
      width={size === "md" ? 24 : size === "xs" ? 16 : 20}
      height={size === "md" ? 24 : size === "xs" ? 16 : 20}
      className={cn(
        "shrink-0 rounded-md object-cover ring-1 ring-newsroom-border/80",
        box,
        className
      )}
      onError={() => setFailed(true)}
      loading="lazy"
      decoding="async"
    />
  );
}

/** Editorial source line: [Logo] Publication · Author · Date */
export function SourceRow({
  publication,
  author,
  date,
  url,
  className,
  twoLine,
}: {
  publication?: string | null;
  author?: string | null;
  date?: string | null;
  url?: string | null;
  className?: string;
  twoLine?: boolean;
}) {
  const pub = (publication || "").trim() || "information unavailable";
  const who = (author || "").trim();
  const when = (date || "").trim();

  if (twoLine) {
    return (
      <div className={cn("flex items-start gap-2", className)}>
        <PublisherLogo name={publication} url={url} size="sm" className="mt-0.5" />
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-white/90">{pub}</p>
          <p className="truncate text-[11px] text-newsroom-muted">
            {[who || null, when || null].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex min-w-0 items-center gap-2 text-[11px] text-newsroom-muted", className)}>
      <PublisherLogo name={publication} url={url} size="xs" />
      <p className="min-w-0 truncate">
        <span className="font-medium text-white/85">{pub}</span>
        {who ? (
          <>
            <span className="mx-1.5 text-newsroom-border">·</span>
            <span>{who}</span>
          </>
        ) : null}
        {when ? (
          <>
            <span className="mx-1.5 text-newsroom-border">·</span>
            <span>{when}</span>
          </>
        ) : null}
      </p>
    </div>
  );
}
