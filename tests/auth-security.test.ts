import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { normalizeEmail } from "../src/lib/email";
import { loginThrottleKey } from "../src/lib/login-throttle";

const root = path.resolve(__dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

assert.equal(normalizeEmail("  Alice@Example.COM "), "alice@example.com");
assert.equal(loginThrottleKey("alice@example.com", "203.0.113.4").length, 64);
assert.notEqual(
  loginThrottleKey("alice@example.com", "203.0.113.4"),
  loginThrottleKey("alice@example.com", "203.0.113.5")
);

const migration = read("prisma/migrations/20260630210000_auth_revocation_and_identity/migration.sql");
assert.match(migration, /lower\(trim\("email"\)\)/);
assert.match(migration, /owners_email_lower_key/);
assert.match(migration, /oauth_access_tokens/);
assert.match(migration, /login_attempts/);
assert.match(migration, /rate_limit_buckets/);

const tokens = read("src/lib/tokens.ts");
assert.match(tokens, /DELETE FROM verification_tokens[\s\S]*RETURNING identifier/);
assert.match(tokens, /sessionVersion: \{ increment: 1 \}/);
assert.ok(
  tokens.indexOf("DELETE FROM verification_tokens") < tokens.indexOf("tx.owner.update"),
  "reset token consumption and password update must share one transaction"
);

const oauth = read("src/lib/oauth-tokens.ts");
assert.match(oauth, /prisma\.oAuthAccessToken\.create/);
assert.match(oauth, /record\.credentialVersion !== record\.agent\.credentialVersion/);
assert.doesNotMatch(oauth, /new Map/);

const regenerate = read("src/app/api/settings/regenerate-key/route.ts");
assert.match(regenerate, /credentialVersion: \{ increment: 1 \}/);
assert.match(regenerate, /oAuthAccessToken\.updateMany/);

const authOptions = read("src/lib/auth-options.ts");
assert.match(authOptions, /isLoginBlocked\(throttleKey\)/);
assert.match(authOptions, /recordLoginFailure\(throttleKey/);
assert.match(authOptions, /owner\.sessionVersion !== token\.sessionVersion/);
assert.match(authOptions, /debug: process\.env\.NEXTAUTH_DEBUG === "true"/);
assert.doesNotMatch(authOptions, /debug: process\.env\.NODE_ENV === "development"/);
assert.match(authOptions, /id: "telegram"/);
assert.match(authOptions, /wellKnown: "https:\/\/oauth\.telegram\.org\/\.well-known\/openid-configuration"/);
assert.match(authOptions, /checks: \["pkce", "state", "nonce"\]/);
assert.match(authOptions, /where: \{ telegramId \}/);
assert.match(authOptions, /provider_providerAccountId/);
assert.match(authOptions, /linkedAccount\.userId !== owner\.id/);

const telegramLoginDocs = read("docs/TELEGRAM_WEB_LOGIN.md");
assert.match(telegramLoginDocs, /api\/auth\/callback\/telegram/);
assert.match(telegramLoginDocs, /TELEGRAM_LOGIN_CLIENT_SECRET/);

const rateLimit = read("src/lib/rate-limit.ts");
assert.match(rateLimit, /prisma\.\$transaction/);
assert.match(rateLimit, /rateLimitBucket\.upsert/);
assert.doesNotMatch(rateLimit, /new Map/);
assert.match(read("src/app/api/consent/route.ts"), /await rateLimit\(request/);

console.log("PASS: identities normalize and password, session, API-key, OAuth, and login controls revoke safely");
