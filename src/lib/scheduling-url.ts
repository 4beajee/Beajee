import { z } from "zod";

const ALLOWED_HOSTS = [
  "cal.com",
  "www.cal.com",
  "calendly.com",
  "www.calendly.com",
] as const;

export const SchedulingUrlSchema = z
  .string()
  .trim()
  .url("Must be a valid URL")
  .max(500)
  .refine((value) => value.startsWith("https://"), {
    message: "Scheduling link must use HTTPS",
  })
  .refine((value) => {
    try {
      const host = new URL(value).hostname.toLowerCase();
      return ALLOWED_HOSTS.some(
        (allowed) => host === allowed || host.endsWith(`.${allowed}`)
      );
    } catch {
      return false;
    }
  }, {
    message: "Use a Cal.com or Calendly booking link",
  });

export type SchedulingProvider = "cal.com" | "calendly" | "unknown";

export function normalizeSchedulingUrl(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return SchedulingUrlSchema.parse(trimmed);
}

export function detectSchedulingProvider(url: string): SchedulingProvider {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("calendly.com")) return "calendly";
    if (host.includes("cal.com")) return "cal.com";
    return "unknown";
  } catch {
    return "unknown";
  }
}

export function schedulingProviderLabel(provider: SchedulingProvider) {
  if (provider === "calendly") return "Calendly";
  if (provider === "cal.com") return "Cal.com";
  return "Scheduling";
}