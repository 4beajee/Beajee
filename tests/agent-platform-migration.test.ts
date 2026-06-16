import assert from "node:assert/strict";

type Row = Record<string, any>;

let passed = 0;
function ok(label: string) {
  passed++;
  console.log(`PASS: ${label}`);
}

function createFakePrisma() {
  const db = {
    owners: [
      {
        id: "owner_1",
        agentPlatform: "manus",
        agent: {
          id: "agent_internal_1",
          agentId: "agent_test_1",
          apiKey: "gny_test_key",
          ownerId: "owner_1",
          wakeWebhookEnabled: true,
          webhookUrl: "https://example.com/hooks/wake",
          webhookToken: "secret-token",
          searchPaused: false,
          isActive: true,
        },
      },
    ] as Row[],
    inboxEvents: [] as Row[],
    beacons: [] as Row[],
  };

  return {
    __db: db,
    owner: {
      findUnique: async (args: Row) => {
        const row = db.owners.find((owner) => owner.id === args.where.id) ?? null;
        if (!row) return null;
        if (args.include?.agent) {
          return { ...row, agent: { ...row.agent } };
        }
        return { ...row };
      },
      update: async (args: Row) => {
        const row = db.owners.find((owner) => owner.id === args.where.id);
        if (!row) throw new Error("Owner not found");
        Object.assign(row, args.data);
        return { ...row };
      },
    },
    agent: {
      findUnique: async (args: Row) => {
        const owner = db.owners.find((item) => item.agent.id === args.where.id);
        if (!owner) return null;
        const agent = { ...owner.agent, owner: { ...owner } };
        return agent;
      },
      update: async (args: Row) => {
        const owner = db.owners.find((item) => item.agent.id === args.where.id);
        if (!owner) throw new Error("Agent not found");
        Object.assign(owner.agent, args.data);
        return { ...owner.agent, owner: { ...owner } };
      },
    },
    beacon: {
      updateMany: async (args: Row) => {
        const where = args.where ?? {};
        let count = 0;
        for (const beacon of db.beacons) {
          if (where.agentId && beacon.agentId !== where.agentId) continue;
          if ("isActive" in where && beacon.isActive !== where.isActive) continue;
          if ("preservable" in where && beacon.preservable !== where.preservable) continue;
          Object.assign(beacon, args.data);
          count++;
        }
        return { count };
      },
    },
    inboxEvent: {
      create: async (args: Row) => {
        const event = { id: `inbox_${db.inboxEvents.length + 1}`, ...args.data };
        db.inboxEvents.push(event);
        return event;
      },
    },
    analyticsEvent: {
      create: async (args: Row) => ({ id: "analytics_1", ...args.data }),
    },
  };
}

async function main() {
  const previousPrisma = (globalThis as any).prisma;
  (globalThis as any).prisma = createFakePrisma();

  const { migrateAgentPlatform } = await import(
    "../src/lib/services/agent-platform-migration"
  );

  const result = await migrateAgentPlatform({
    ownerId: "owner_1",
    nextPlatform: "open_claw",
    baseUrl: "http://localhost:3001",
    locale: "en",
  });

  assert.equal(result.changed, true);
  assert.equal(result.agentPlatform, "open_claw");
  assert.equal(result.agentId, "agent_test_1");

  const db = (globalThis as any).prisma.__db;
  assert.equal(db.owners[0].agentPlatform, "open_claw");
  assert.equal(db.owners[0].agent.searchPaused, true);
  assert.equal(db.inboxEvents.length, 2);
  assert.equal(db.inboxEvents.some((event: Row) => event.type === "AGENT_SEARCH_PAUSED"), true);
  assert.equal(
    db.inboxEvents.some((event: Row) => event.type === "AGENT_PLATFORM_CHANGED"),
    true
  );

  const noop = await migrateAgentPlatform({
    ownerId: "owner_1",
    nextPlatform: "open_claw",
    baseUrl: "http://localhost:3001",
  });
  assert.equal(noop.changed, false);

  ok("Agent platform migration keeps credentials, pauses search, and writes inbox events");

  console.log(`\nAll agent platform migration tests passed (${passed} checks).`);

  if (previousPrisma === undefined) delete (globalThis as any).prisma;
  else (globalThis as any).prisma = previousPrisma;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});