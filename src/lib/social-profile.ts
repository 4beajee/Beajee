import { z } from "zod";

export type SocialProfileProvider = "linkedin" | "twitter";

export interface SocialProfileLink {
  provider: SocialProfileProvider;
  url: string;
  label: string;
}

export interface SocialProfiles {
  linkedin: SocialProfileLink | null;
  twitter: SocialProfileLink | null;
}

export interface SocialProfileOwnerFields {
  linkedinUrl?: string | null;
  twitterUrl?: string | null;
}

const MAX_URL_LENGTH = 500;
const RESERVED_TWITTER_PATHS = new Set([
  "compose",
  "explore",
  "help",
  "home",
  "i",
  "intent",
  "messages",
  "notifications",
  "privacy",
  "search",
  "settings",
  "share",
  "tos",
]);

function parseCandidate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("Social profile must be a valid URL");
  if (trimmed.length > MAX_URL_LENGTH) {
    throw new Error(`Social profile URL must be ${MAX_URL_LENGTH} characters or fewer`);
  }

  const withScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new Error("Social profile must be a valid URL");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Social profile must use HTTPS");
  }
  if (url.username || url.password || url.port) {
    throw new Error("Social profile URL cannot contain credentials or a custom port");
  }

  url.protocol = "https:";
  url.search = "";
  url.hash = "";
  return url;
}

function normalizedHost(url: URL) {
  return url.hostname.toLowerCase().replace(/^(?:www\.|m\.|mobile\.)/, "");
}

export function normalizeLinkedInUrl(value: string | null | undefined): string | null {
  if (value == null || !value.trim()) return null;
  const url = parseCandidate(value);
  if (normalizedHost(url) !== "linkedin.com") {
    throw new Error("Use a personal LinkedIn profile URL such as linkedin.com/in/your-name");
  }

  const match = url.pathname.match(/^\/in\/([^/]+)\/?$/i);
  if (!match?.[1]) {
    throw new Error("Use a personal LinkedIn profile URL such as linkedin.com/in/your-name");
  }

  url.hostname = "www.linkedin.com";
  url.pathname = `/in/${match[1]}`;
  return url.toString().replace(/\/$/, "");
}

export function normalizeTwitterUrl(value: string | null | undefined): string | null {
  if (value == null || !value.trim()) return null;
  const url = parseCandidate(value);
  const host = normalizedHost(url);
  if (host !== "x.com" && host !== "twitter.com") {
    throw new Error("Use a Twitter/X profile URL such as x.com/your_handle");
  }

  const match = url.pathname.match(/^\/([A-Za-z0-9_]{1,15})\/?$/);
  if (!match?.[1]) {
    throw new Error("Use a Twitter/X profile URL such as x.com/your_handle");
  }
  if (RESERVED_TWITTER_PATHS.has(match[1].toLowerCase())) {
    throw new Error("Use a Twitter/X profile URL such as x.com/your_handle");
  }

  url.hostname = "x.com";
  url.pathname = `/${match[1]}`;
  return url.toString().replace(/\/$/, "");
}

export function socialProfilesFromOwner(owner: SocialProfileOwnerFields): SocialProfiles {
  const linkedinUrl = owner.linkedinUrl ?? null;
  const twitterUrl = owner.twitterUrl ?? null;
  return {
    linkedin: linkedinUrl
      ? {
          provider: "linkedin",
          url: linkedinUrl,
          label: new URL(linkedinUrl).pathname.replace(/^\/in\//, "/in/"),
        }
      : null,
    twitter: twitterUrl
      ? {
          provider: "twitter",
          url: twitterUrl,
          label: `@${new URL(twitterUrl).pathname.replace(/^\//, "")}`,
        }
      : null,
  };
}

export const SocialProfilePatchSchema = z
  .object({
    linkedin: z.string().max(MAX_URL_LENGTH).nullable().optional(),
    twitter: z.string().max(MAX_URL_LENGTH).nullable().optional(),
  })
  .refine(
    (value) => value.linkedin !== undefined || value.twitter !== undefined,
    "At least one social profile must be provided"
  );

export type SocialProfilePatch = z.infer<typeof SocialProfilePatchSchema>;

export function normalizeSocialProfilePatch(patch: SocialProfilePatch) {
  return {
    ...(patch.linkedin !== undefined
      ? { linkedinUrl: normalizeLinkedInUrl(patch.linkedin) }
      : {}),
    ...(patch.twitter !== undefined
      ? { twitterUrl: normalizeTwitterUrl(patch.twitter) }
      : {}),
  };
}

export const __test = { MAX_URL_LENGTH, RESERVED_TWITTER_PATHS };
