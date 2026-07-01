import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf8");

let passed = 0;
function ok(label: string) {
  passed++;
  console.log(`PASS: ${label}`);
}

{
  const page = read("src/app/(public)/telegram/page.tsx");
  const layout = read("src/app/(public)/telegram/layout.tsx");
  const styles = read("src/app/(public)/telegram/telegram.css");
  assert.match(page, /requestFullscreen/);
  assert.match(page, /safe-area-inset-bottom/);
  assert.match(layout, /viewportFit:\s*"cover"/);
  assert.doesNotMatch(page, />Mini App</);
  ok("Web App uses fullscreen safe-area layout without the legacy internal header");

  assert.match(page, /telegram-float/);
  assert.match(page, /rounded-full/);
  assert.doesNotMatch(page, /#d9ff7a|red-|green-|amber-|emerald-/);
  assert.doesNotMatch(page, /<nav className="fixed|className="sticky/);
  assert.match(styles, /prefers-reduced-motion/);
  assert.match(layout, /themeColor:\s*"#000000"/);
  ok("the visual system stays monochrome, rounded, floating, and free of fixed navigation blocks");
}

{
  const page = read("src/app/(public)/telegram/page.tsx");
  for (const destination of ["today", "matches", "chats", "you"]) {
    assert.match(page, new RegExp(`"${destination}"`));
  }
  assert.match(page, /Review agent settings/);
  assert.match(page, /How the agents decided/);
  assert.match(page, /Only privacy-filtered published context was used/);
  ok("Today, Matches, Chats, and You implement the decision-layer information architecture");
}

{
  const auth = read("src/app/api/telegram/auth/route.ts");
  const token = read("src/lib/telegram/auth.ts");
  assert.match(auth, /export async function GET/);
  assert.match(auth, /getAuthenticatedOwner/);
  assert.match(token, /issueUnifiedTokenForOwner/);
  ok("the same Web App authenticates through Telegram initData or an existing browser session");
}

{
  const routes = [
    "src/app/api/telegram/onboarding/route.ts",
    "src/app/api/telegram/settings/route.ts",
    "src/app/api/telegram/matches/route.ts",
    "src/app/api/telegram/chats/route.ts",
    "src/app/api/telegram/call/[matchId]/route.ts",
  ];
  for (const route of routes) {
    assert.match(read(route), /verifyUnifiedToken/);
  }
  assert.match(read(routes[0]), /completeOwnerOnboarding/);
  assert.match(read(routes[2]), /confirmMatch/);
  assert.match(read(routes[2]), /markDormant/);
  assert.match(read(routes[3]), /createInboxEvent/);
  assert.match(read(routes[4]), /requestZoomCall/);
  ok("Telegram APIs cover onboarding, settings, decisions, chat delivery, and calls with owner auth");
}

{
  const page = read("src/app/(public)/telegram/page.tsx");
  const bot = read("src/lib/telegram/bot.ts");
  const onboarding = read("src/lib/telegram/onboarding.ts");
  const webhook = read("src/app/api/telegram/webhook/route.ts");
  const card = read("src/lib/telegram/match-card.ts");
  const negotiation = read("src/lib/services/negotiation.ts");
  assert.doesNotMatch(bot, /Set up workspace topics/);
  assert.match(card, /Review introduction/);
  assert.match(card, /searchParams\.set\("matchId"/);
  assert.match(card, /sendTelegramChatNotification/);
  assert.match(card, /sendTelegramCallRequest/);
  assert.match(negotiation, /sendTelegramMatchCard/);
  ok("bot entry points deep-link exact proposal, chat, and call actions into the Web App");

  assert.match(onboarding, /not a general AI chat/);
  assert.match(onboarding, /Start here/);
  assert.match(onboarding, /Today, Matches, Chats, calls, and your settings/);
  assert.match(onboarding, /TELEGRAM_SUPPORT_USERNAME = "GGen1e"/);
  assert.match(onboarding, /https:\/\/t\.me\/\$\{TELEGRAM_SUPPORT_USERNAME\}/);
  assert.match(page, /Technical help/);
  assert.match(page, /Message @\{TELEGRAM_SUPPORT_USERNAME\}/);
  assert.match(webhook, /command === "\/help"/);
  assert.match(webhook, /guided: true/);
  assert.match(webhook, /message\.chat\.type !== "private"/);
  ok("first-run and free-form messages explain how to use the bot without spamming groups");
}

console.log(`\nAll ${passed} Telegram Web App tests passed.`);
