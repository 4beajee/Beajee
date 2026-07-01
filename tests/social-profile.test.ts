import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  normalizeLinkedInUrl,
  normalizeSocialProfilePatch,
  normalizeTwitterUrl,
  socialProfilesFromOwner,
} from "../src/lib/social-profile";
import {
  buildMatchCardPerson,
  canRevealMatchSocialProfiles,
} from "../src/lib/services/match-card-view";
import { buildMatchCardKeyboard } from "../src/lib/telegram/match-card";
import { supportsNativeProfilePrompts } from "../src/lib/agent-platform";

const ROOT = path.resolve(import.meta.dirname ?? __dirname, "..");
let passed = 0;
function ok(label: string) {
  passed++;
  console.log(`PASS: ${label}`);
}

assert.equal(
  normalizeLinkedInUrl("linkedin.com/in/Alex-Morozov/?trk=profile#about"),
  "https://www.linkedin.com/in/Alex-Morozov"
);
assert.equal(
  normalizeLinkedInUrl("http://www.linkedin.com/in/alex"),
  "https://www.linkedin.com/in/alex"
);
ok("normalizes personal LinkedIn profiles and strips tracking data");

for (const invalid of [
  "https://linkedin.example/in/alex",
  "https://linkedin.com/company/beajee",
  "https://linkedin.com/posts/alex_hello",
  "ftp://linkedin.com/in/alex",
  "https://user:pass@linkedin.com/in/alex",
]) {
  assert.throws(() => normalizeLinkedInUrl(invalid));
}
ok("rejects unsafe or non-personal LinkedIn URLs");

assert.equal(normalizeTwitterUrl("twitter.com/Alex_Builds?ref=home"), "https://x.com/Alex_Builds");
assert.equal(normalizeTwitterUrl("https://mobile.x.com/alex"), "https://x.com/alex");
ok("accepts Twitter and X domains and stores one canonical URL");

for (const invalid of [
  "https://x.example/alex",
  "https://x.com/alex/status/123",
  "https://twitter.com/intent/tweet",
  "https://x.com/search",
  "https://x.com/home",
  "https://x.com/this_handle_is_far_too_long",
]) {
  assert.throws(() => normalizeTwitterUrl(invalid));
}
ok("rejects Twitter/X actions and invalid handles");

assert.deepEqual(normalizeSocialProfilePatch({ linkedin: "" }), { linkedinUrl: null });
assert.deepEqual(normalizeSocialProfilePatch({ twitter: null }), { twitterUrl: null });
assert.deepEqual(normalizeSocialProfilePatch({ linkedin: "linkedin.com/in/alex" }), {
  linkedinUrl: "https://www.linkedin.com/in/alex",
});
ok("patch semantics distinguish omission from clearing");

assert.deepEqual(
  socialProfilesFromOwner({
    linkedinUrl: "https://www.linkedin.com/in/alex",
    twitterUrl: "https://x.com/alex_builds",
  }),
  {
    linkedin: {
      provider: "linkedin",
      url: "https://www.linkedin.com/in/alex",
      label: "/in/alex",
    },
    twitter: {
      provider: "twitter",
      url: "https://x.com/alex_builds",
      label: "@alex_builds",
    },
  }
);
ok("builds presentation-safe labels without fetching providers");

const person = buildMatchCardPerson({
  agentId: "agent_b",
  owner: {
    id: "owner_b",
    name: "Alex",
    linkedinUrl: "https://www.linkedin.com/in/alex",
    twitterUrl: "https://x.com/alex_builds",
  },
  context: { currentWork: "Agent memory", expertise: ["memory"] },
});
assert.equal(person.socialProfiles.linkedin?.label, "/in/alex");
assert.equal(person.socialProfiles.twitter?.label, "@alex_builds");
ok("canonical match-card person includes the same social profile shape");

assert.equal(canRevealMatchSocialProfiles("NEGOTIATING"), false);
assert.equal(canRevealMatchSocialProfiles("PROPOSED"), true);
assert.equal(canRevealMatchSocialProfiles("MATCHED"), true);
assert.equal(canRevealMatchSocialProfiles("DORMANT"), true);
ok("social profiles stay hidden until mutual agent agreement");

process.env.TELEGRAM_MINI_APP_URL = "https://app.beajee.com/telegram";
const keyboard = buildMatchCardKeyboard("match_1", person.socialProfiles);
assert.equal(keyboard.inline_keyboard.length, 2);
assert.equal(keyboard.inline_keyboard[0]?.[0]?.text, "LinkedIn");
assert.equal(keyboard.inline_keyboard[0]?.[0]?.style, "primary");
assert.equal(keyboard.inline_keyboard[0]?.[0]?.url, "https://www.linkedin.com/in/alex");
assert.equal(keyboard.inline_keyboard[0]?.[1]?.text, "𝕏  X");
assert.equal(keyboard.inline_keyboard[0]?.[1]?.style, undefined);
assert.equal(keyboard.inline_keyboard[0]?.[1]?.url, "https://x.com/alex_builds");
assert.match(keyboard.inline_keyboard[1]?.[0]?.web_app?.url ?? "", /matchId=match_1/);
ok("Telegram match card exposes styled provider links above an exact match deep link");

assert.equal(supportsNativeProfilePrompts("open_claw"), true);
assert.equal(supportsNativeProfilePrompts("custom"), true);
assert.equal(supportsNativeProfilePrompts("codex"), false);
assert.equal(supportsNativeProfilePrompts("claude_code"), false);
ok("profile prompts respect the coding-session delivery boundary");

const schema = fs.readFileSync(path.join(ROOT, "prisma/schema.prisma"), "utf8");
assert.match(schema, /linkedinUrl\s+String\?/);
assert.match(schema, /twitterUrl\s+String\?/);
assert.match(schema, /socialProfilesPromptedAt\s+DateTime\?/);
ok("Prisma schema stores optional links and prompt state");

const mcpRoute = fs.readFileSync(path.join(ROOT, "src/app/api/mcp/route.ts"), "utf8");
const mcpServer = fs.readFileSync(path.join(ROOT, "src/lib/mcp/server.ts"), "utf8");
assert.match(mcpRoute, /setSocialProfilesTool/);
assert.match(mcpServer, /setSocialProfilesTool/);
ok("both MCP transports register set_social_profiles");

const promptService = fs.readFileSync(
  path.join(ROOT, "src/lib/services/social-profile-prompt.ts"),
  "utf8"
);
assert.match(promptService, /socialProfilesPromptedAt/);
assert.match(promptService, /telegram.*native_agent/s);
assert.match(promptService, /PROFILE_COMPLETION_SUGGESTION/);
ok("one-time prompt service prefers Telegram and supports native agents");

assert.equal(
  fs.readFileSync(path.join(ROOT, "skill.md"), "utf8"),
  fs.readFileSync(path.join(ROOT, "public/skill.md"), "utf8")
);
ok("root and public MCP instructions remain aligned");

console.log(`\nAll ${passed} social profile tests passed.`);
