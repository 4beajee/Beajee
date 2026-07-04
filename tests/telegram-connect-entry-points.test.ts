import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const component = fs.readFileSync(
  path.join(ROOT, "src/components/telegram-connect-card.tsx"),
  "utf8"
);
const home = fs.readFileSync(path.join(ROOT, "src/app/(app)/home/page.tsx"), "utf8");
const matches = fs.readFileSync(path.join(ROOT, "src/app/(app)/matches/page.tsx"), "utf8");
const contextDelivery = fs.readFileSync(
  path.join(ROOT, "src/components/context-check-in-delivery.tsx"),
  "utf8"
);
const linkRoute = fs.readFileSync(
  path.join(ROOT, "src/app/api/telegram/link/route.ts"),
  "utf8"
);
const envExample = fs.readFileSync(path.join(ROOT, ".env.example"), "utf8");

assert.match(component, /bg-\[#229ED9\]/, "Telegram CTA uses Telegram's brand blue");
assert.match(component, /viewBox="0 0 240\.1 240\.1"/, "Telegram CTA uses the official logo geometry");
assert.match(component, /stopColor="#2AABEE"/);
assert.match(component, /stopColor="#229ED9"/);
assert.match(component, /fill="#FFFFFF"/);
assert.match(component, /fetch\("\/api\/telegram\/link", \{ method: "POST" \}\)/);
assert.match(component, /window\.location\.assign\(data\.url\)/);
assert.doesNotMatch(component, /window\.open\(/, "Mobile sync must not depend on popups");
assert.match(contextDelivery, /window\.location\.assign\(data\.url\)/);
assert.doesNotMatch(contextDelivery, /window\.open\(/, "Settings sync must not depend on popups");
assert.match(contextDelivery, /visibilitychange/, "Returning from Telegram re-checks sync immediately");
assert.match(linkRoute, /\[telegram-link\] failed:/, "Production failures are observable");
assert.match(linkRoute, /Telegram sync is temporarily unavailable/);
assert.match(envExample, /TELEGRAM_BOT_USERNAME/, "Deployment config documents the required bot username");
assert.match(component, /if \(connected\) return null/, "CTA disappears after account sync");
assert.match(home, /placement="home"/, "Home renders the Telegram entry point");
assert.match(matches, /placement="matches"/, "Matches renders the Telegram entry point");
assert.match(matches, /settings\.telegramConnected/, "Matches respects existing Telegram sync");

console.log("PASS: Home and Matches expose the branded Telegram account-sync entry point");
