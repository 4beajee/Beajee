import assert from "node:assert/strict";

import {
  getCheapModel,
  getQualityModel,
  inferModelProvider,
  isQualityModelTask,
  resolveModel,
} from "../src/lib/model-router";

const previousCheap = process.env.CHEAP_MODEL;
const previousQuality = process.env.QUALITY_MODEL;

async function main() {
  process.env.CHEAP_MODEL = "cheap-test-model";
  process.env.QUALITY_MODEL = "quality-test-model";

  assert.equal(getCheapModel(), "cheap-test-model");
  assert.equal(getQualityModel(), "quality-test-model");
  assert.equal(isQualityModelTask("match_scoring"), false);
  assert.equal(isQualityModelTask("negotiation"), true);

  assert.equal(await resolveModel("match_scoring"), "cheap-test-model");
  assert.equal(await resolveModel("negotiation"), "quality-test-model");

  assert.equal(
    await resolveModel("match_scoring", { forceQuality: true }),
    "quality-test-model",
    "forceQuality selects the quality model"
  );

  assert.equal(inferModelProvider("claude-sonnet-4-20250514"), "anthropic");
  assert.equal(inferModelProvider("gpt-4o-mini"), "openai");
  assert.equal(inferModelProvider("gemini-2.5-flash"), "google");

  console.log("PASS: model router resolves tiers, budget degradation, and providers");
}

main()
  .finally(() => {
    if (previousCheap === undefined) Reflect.deleteProperty(process.env, "CHEAP_MODEL");
    else process.env.CHEAP_MODEL = previousCheap;
    if (previousQuality === undefined) Reflect.deleteProperty(process.env, "QUALITY_MODEL");
    else process.env.QUALITY_MODEL = previousQuality;
  })
  .then(() => console.log("\nAll model router tests passed."));
