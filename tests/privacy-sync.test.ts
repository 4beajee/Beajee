import assert from "assert";
import { buildPrivacyChangePayload } from "../src/lib/privacy-change";
import fs from "node:fs";
import path from "node:path";

{
  const payload = buildPrivacyChangePayload({
    previousExcludedTopics: [],
    nextExcludedTopics: ["Finances & debts"],
    allTopics: [
      "Health & personal issues",
      "Finances & debts",
      "Personal relationships",
      "Psychological topics",
    ],
  });

  assert.ok(payload, "payload should be created when topics change");
  assert.deepStrictEqual(payload?.newly_excluded, ["Finances & debts"]);
  assert.deepStrictEqual(payload?.newly_allowed, []);
  assert.strictEqual(payload?.suppress_search_until_republish, true);
  assert.ok(
    payload?.recommended_removals.some((item) => item.includes("financial")),
    "stricter privacy should suggest removing financial details"
  );

  console.log("PASS: stricter privacy change builds a suppression payload");
}

{
  const root = path.resolve(__dirname, "..");
  const service = fs.readFileSync(path.join(root, "src/lib/services/privacy-sync.ts"), "utf8");
  assert.match(service, /prisma\.\$transaction\(async \(tx\)/);
  assert.match(service, /tx\.owner\.update/);
  assert.match(service, /SET embedding = NULL/);
  assert.match(service, /tx\.beacon\.deleteMany/);
  assert.match(service, /tx\.inboxEvent\.create/);

  const settings = fs.readFileSync(path.join(root, "src/app/api/settings/route.ts"), "utf8");
  assert.doesNotMatch(settings, /ownerUpdate\.excludedTopics/);

  const profile = fs.readFileSync(path.join(root, "src/app/api/profiles/[ownerId]/route.ts"), "utf8");
  for (const privateField of ["recentProblems", "recentWins", "notLookingFor", "ownerGoals"]) {
    assert.doesNotMatch(profile, new RegExp(privateField));
  }
  assert.match(profile, /freshnessState === "STALE" \? null/);

  console.log("PASS: privacy tightening is atomic and public profiles use a safe projection");
}

{
  const payload = buildPrivacyChangePayload({
    previousExcludedTopics: ["Psychological topics"],
    nextExcludedTopics: [],
    allTopics: [
      "Health & personal issues",
      "Finances & debts",
      "Personal relationships",
      "Psychological topics",
    ],
  });

  assert.ok(payload, "payload should be created when a topic becomes allowed");
  assert.deepStrictEqual(payload?.newly_excluded, []);
  assert.deepStrictEqual(payload?.newly_allowed, ["Psychological topics"]);
  assert.strictEqual(payload?.suppress_search_until_republish, false);
  assert.ok(
    payload?.recommended_additions.some((item) => item.includes("working style")),
    "looser privacy should suggest what can be added back"
  );

  console.log("PASS: looser privacy change builds addition guidance");
}

{
  const payload = buildPrivacyChangePayload({
    previousExcludedTopics: ["Health & personal issues"],
    nextExcludedTopics: ["Health & personal issues"],
    allTopics: [
      "Health & personal issues",
      "Finances & debts",
      "Personal relationships",
      "Psychological topics",
    ],
  });

  assert.strictEqual(payload, null, "unchanged topics should not generate work");

  console.log("PASS: unchanged privacy settings do not create a task");
}

console.log("\nAll privacy sync tests passed.");
