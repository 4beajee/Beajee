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

assert.match(component, /bg-\[#229ED9\]/, "Telegram CTA uses Telegram's brand blue");
assert.match(component, /<svg/, "Telegram CTA includes an inline SVG logo");
assert.match(component, /fetch\("\/api\/telegram\/link", \{ method: "POST" \}\)/);
assert.match(component, /if \(connected\) return null/, "CTA disappears after account sync");
assert.match(home, /placement="home"/, "Home renders the Telegram entry point");
assert.match(matches, /placement="matches"/, "Matches renders the Telegram entry point");
assert.match(matches, /settings\.telegramConnected/, "Matches respects existing Telegram sync");

console.log("PASS: Home and Matches expose the branded Telegram account-sync entry point");
