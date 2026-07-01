import Image from "next/image";
import type { AgentPlatformValue } from "@/lib/agent-platform";

export function AgentPlatformLogo({ platform }: { platform: AgentPlatformValue }) {
  if (platform === "folk") {
    return (
      <Image
        src="/agent-platforms/folk.webp"
        alt=""
        width={24}
        height={24}
        className="h-6 w-6 shrink-0 rounded-md object-cover"
      />
    );
  }

  if (platform === "open_claw") {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" aria-hidden="true">
        <path
          d="M12 2.6c-6.3 0-9.5 5.3-9.5 9.5 0 4.2 3.2 8.4 6.3 9.5v2.1h2.1v-2.1c.7.2 1.4.2 2.1 0v2.1h2.1v-2.1c3.2-1.1 6.3-5.3 6.3-9.5S18.3 2.6 12 2.6Z"
          fill="#ef4444"
        />
        <path d="M3.6 10c-3.2-1.1-4.2 1-3.2 3.1 1.1 2.1 3.2 1.1 4.2-1.1.7-1.4 0-2-1-2Zm16.8 0c3.2-1.1 4.2 1 3.2 3.1-1.1 2.1-3.2 1.1-4.2-1.1-.7-1.4 0-2 1-2Z" fill="#b91c1c" />
        <circle cx="8.8" cy="8" r="1.25" fill="#080808" />
        <circle cx="15.2" cy="8" r="1.25" fill="#080808" />
      </svg>
    );
  }

  if (platform === "codex") {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0 text-white" fill="currentColor" aria-hidden="true">
        <path d="M9.1 3.3a4.6 4.6 0 0 1 5 .1 4.6 4.6 0 0 1 5.2.3 4.6 4.6 0 0 1 2.3 5.3 4.6 4.6 0 0 1 .3 5.3 4.6 4.6 0 0 1-4.1 3.4 4.6 4.6 0 0 1-4.4 3.3 4.6 4.6 0 0 1-3.5-1.3 4.6 4.6 0 0 1-5.3-2.3 4.6 4.6 0 0 1 .4-5.2 4.6 4.6 0 0 1 2-5.4 4.6 4.6 0 0 1 2.1-3.5Zm3.5 10.6a.64.64 0 0 0 0 1.3h3.6a.64.64 0 1 0 0-1.3h-3.6ZM8.5 9.2a.64.64 0 0 0-1.1.7l1.2 2.2-1.2 2.1a.64.64 0 1 0 1.1.7l1.4-2.5a.64.64 0 0 0 0-.6L8.5 9.2Z" />
      </svg>
    );
  }

  if (platform === "claude_code") {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" aria-hidden="true">
        <path d="M21 11h3v3h-3v3h-1.5v3H18v-3h-1.5v3H15v-3H9v3H7.5v-3H6v3H4.5v-3H3v-3H0v-3h3V5h18v6ZM6 11h1.5V8H6v3Zm10.5 0H18V8h-1.5v3Z" fill="#d97757" />
      </svg>
    );
  }

  if (platform === "fork") {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0 text-white" fill="none" aria-hidden="true">
        <circle cx="7" cy="5" r="2" fill="currentColor" />
        <circle cx="17" cy="5" r="2" fill="currentColor" />
        <circle cx="12" cy="19" r="2" fill="currentColor" />
        <path d="M7 7v2.5c0 2 1.5 3.5 3.5 3.5H12m5-6v2.5c0 2-1.5 3.5-3.5 3.5H12m0 0v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }

  const monogram = platform === "hermes" ? "H" : platform === "manus" ? "M" : "+";
  return (
    <span
      aria-hidden="true"
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white text-[11px] font-bold text-black"
    >
      {monogram}
    </span>
  );
}
