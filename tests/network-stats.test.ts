import assert from "node:assert/strict";
import {
  getDisplayedNetworkMembers,
  NETWORK_MEMBERS_BASELINE,
} from "../src/lib/network-stats";

assert.equal(NETWORK_MEMBERS_BASELINE, 131);
assert.equal(getDisplayedNetworkMembers(10), 141);
assert.equal(getDisplayedNetworkMembers(0), 131);
assert.equal(getDisplayedNetworkMembers(-1), 131);

console.log("network stats tests passed");
