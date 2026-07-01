import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const agentId = 'agent__mqkaclfw';
  const agent = await prisma.agent.findUnique({
    where: { agentId },
    include: {
      context: true,
    }
  });

  if (!agent) {
    console.log('Agent not found');
    return;
  }

  const events = await prisma.inboxEvent.findMany({
    where: { agentId: agent.id },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  console.log('--- Agent State ---');
  console.log(`Agent ID: ${agent.agentId}`);
  console.log(`isActive: ${agent.isActive}`);
  console.log(`searchPaused: ${agent.searchPaused}`);
  
  if (agent.context) {
    console.log('\n--- Context State ---');
    console.log(`freshnessState: ${agent.context.freshnessState}`);
    console.log(`lastSignificantUpdateAt: ${agent.context.lastSignificantUpdateAt}`);
    console.log(`updatedAt: ${agent.context.updatedAt}`);
  } else {
    console.log('\n--- Context State ---');
    console.log('No context found');
  }

  if (events.length > 0) {
    console.log('\n--- Recent Inbox Events ---');
    for (const e of events) {
      console.log(`[${e.createdAt}] ${e.type}: ${JSON.stringify(e.payload)}`);
    }
  } else {
    console.log('\n--- Inbox Events ---');
    console.log('No recent events found');
  }
}

main()
  .catch(e => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
