"use client";

import {
  cx,
  primaryButtonClass,
  subtleButtonClass,
} from "@/components/ui/app-chrome";

interface ScheduleCallButtonProps {
  url: string;
  providerLabel?: string | null;
  hostName?: string | null;
  variant?: "primary" | "secondary" | "inline";
  className?: string;
}

function CalendarSparkIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
    </svg>
  );
}

export function ScheduleCallButton({
  url,
  providerLabel,
  hostName,
  variant = "primary",
  className,
}: ScheduleCallButtonProps) {
  const label = providerLabel ? `Book on ${providerLabel}` : "Book a time";
  const buttonClass =
    variant === "secondary"
      ? subtleButtonClass
      : variant === "inline"
        ? "inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-zinc-950 shadow-sm ring-1 ring-inset ring-zinc-200 transition hover:bg-zinc-50"
        : primaryButtonClass;

  return (
    <div className={cx("flex flex-col gap-2", className)}>
      {hostName && (
        <p className="text-xs text-neutral-400">
          Pick a time with {hostName}. One booking link keeps both calendars aligned.
        </p>
      )}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={cx(buttonClass, "inline-flex items-center justify-center gap-2")}
      >
        <CalendarSparkIcon />
        <span>{label}</span>
      </a>
    </div>
  );
}