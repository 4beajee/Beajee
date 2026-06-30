/**
 * seed-test-env.ts
 *
 * Creates a local test environment with:
 * - 6 realistic test users (owners + agents + contexts)
 * - 4 MATCHED matches with chats (varied message counts)
 * - 2 PROPOSED matches (for feed / pending proposals)
 * - 3 matches between test users (feed social proof)
 * - Negotiation logs for all matches
 *
 * Usage:
 *   npx tsx scripts/seed-test-env.ts                   # auto-finds your account
 *   npx tsx scripts/seed-test-env.ts gleb@example.com  # specify email
 *
 * SAFE: does NOT delete existing data. Only adds test records.
 * Re-runnable: cleans up previous test data (by email pattern) before inserting.
 */

import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

function generateApiKey(): string {
  return `gny_test_${crypto.randomBytes(16).toString("hex")}`;
}

// ── Test Users ──────────────────────────────────────────────────────────────

const testUsers = [
  {
    name: "Elena Vasquez",
    email: "elena.test@beajee.dev",
    agentId: "agent_elena_test_001",
    goal: "collaboration" as const,
    displayName: "Elena",
    context: {
      ownerName: "Elena Vasquez",
      ownerProfession: "Product Designer & Design Systems Lead",
      ownerDomain: "Design Systems and Component Libraries",
      ownerExperience: "9 years in product design, 4 years leading design systems at Figma and Airbnb",
      ownerGoals: "Open-source the most developer-friendly design system with built-in accessibility",
      ownerLocation: "Barcelona, Spain",
      agentSpecialization: "Finding engineers who care about DX and accessibility in component libraries",
      agentDomains: ["design systems", "accessibility", "React", "developer experience"],
      agentConstraints: "Must care about accessibility, not just aesthetics",
      collaborationStyle: "Pair design sessions, async Figma reviews, weekly standups",
      communicationStyle: "Visual-first, prefers prototypes over long docs",
      currentWork: "Building an open-source design system with AI-powered accessibility auditing",
      expertise: ["design systems", "accessibility", "Figma", "React", "CSS"],
      lookingFor: "Frontend engineers passionate about component APIs and accessibility testing",
      notLookingFor: "Backend-only engineers or people who treat design as decoration",
      recentProblems: "Color contrast scoring inconsistent across different rendering engines",
      recentWins: "Design system adopted by 40+ teams internally, open-source launch in 2 months",
      location: "Barcelona",
      networkingGoal: "collaboration" as const,
    },
  },
  {
    name: "Daniel Park",
    email: "daniel.test@beajee.dev",
    agentId: "agent_daniel_test_002",
    goal: "partnership" as const,
    displayName: "Daniel",
    context: {
      ownerName: "Daniel Park",
      ownerProfession: "Backend Engineer & Distributed Systems Architect",
      ownerDomain: "Real-Time Collaboration Infrastructure",
      ownerExperience: "11 years in backend, ex-Google Docs infrastructure team",
      ownerGoals: "Make real-time collaboration a commodity that any app can add in a day",
      ownerLocation: "Seoul, South Korea",
      agentSpecialization: "Finding co-founders with frontend SDK experience for real-time features",
      agentDomains: ["CRDTs", "real-time sync", "distributed systems", "developer tools"],
      agentConstraints: "Co-founder must understand client-side state management deeply",
      collaborationStyle: "Intense co-building sprints with deep async design docs in between",
      communicationStyle: "Whiteboard-first, loves system diagrams and sequence charts",
      currentWork: "Developing a CRDT-based real-time sync engine as an embeddable SDK",
      expertise: ["CRDTs", "WebSockets", "Rust", "distributed systems", "Go"],
      lookingFor: "A technical partner who can build the frontend SDK and developer experience layer",
      notLookingFor: "People who think real-time just means polling every 2 seconds",
      recentProblems: "Conflict resolution in nested CRDT structures with concurrent array operations",
      recentWins: "Sub-50ms sync latency at 10K concurrent users in stress tests",
      location: "Seoul",
      networkingGoal: "partnership" as const,
    },
  },
  {
    name: "Anya Petrova",
    email: "anya.test@beajee.dev",
    agentId: "agent_anya_test_003",
    goal: "peer" as const,
    displayName: "Anya",
    context: {
      ownerName: "Anya Petrova",
      ownerProfession: "Data Engineer & Observability Specialist",
      ownerDomain: "Data Pipeline Monitoring and Quality",
      ownerExperience: "7 years in data engineering, built Spotify's data quality framework",
      ownerGoals: "Bring SRE-level observability to data pipelines — alerting before data goes bad",
      ownerLocation: "Amsterdam, Netherlands",
      agentSpecialization: "Connecting with SREs and data engineers building pipeline observability",
      agentDomains: ["data engineering", "observability", "data quality", "streaming"],
      agentConstraints: "Peers only, no vendor pitches or consulting offers",
      collaborationStyle: "Knowledge sharing through blog posts, open-source contributions, and conf talks",
      communicationStyle: "Analytical and metric-driven, loves dashboards and alert design",
      currentWork: "Building an open-source data pipeline observability tool with anomaly detection",
      expertise: ["Apache Spark", "dbt", "data quality", "Python", "Grafana"],
      lookingFor: "Data engineers and SREs who are solving pipeline monitoring in creative ways",
      notLookingFor: "Data warehouse vendors or BI tool sellers",
      recentProblems: "False positive rate on schema drift detection is too high for streaming sources",
      recentWins: "Open-source tool reached 3K stars, adopted by 2 Fortune 500 data teams",
      location: "Amsterdam",
      networkingGoal: "peer" as const,
    },
  },
  {
    name: "Marco Rossi",
    email: "marco.test@beajee.dev",
    agentId: "agent_marco_test_004",
    goal: "collaboration" as const,
    displayName: "Marco",
    context: {
      ownerName: "Marco Rossi",
      ownerProfession: "Mobile Developer & SDK Author",
      ownerDomain: "Cross-Platform Mobile Development",
      ownerExperience: "8 years in mobile, created a popular React Native navigation library",
      ownerGoals: "Build the standard cross-platform analytics SDK that respects user privacy",
      ownerLocation: "Milan, Italy",
      agentSpecialization: "Finding privacy-focused engineers to collaborate on analytics SDK",
      agentDomains: ["mobile development", "privacy", "analytics", "React Native"],
      agentConstraints: "Must understand both iOS and Android ecosystems",
      collaborationStyle: "Open-source community building, RFC-driven decisions, monthly releases",
      communicationStyle: "Concise, PR-driven, values working code over lengthy discussions",
      currentWork: "Creating a privacy-first mobile analytics SDK with on-device processing",
      expertise: ["React Native", "Swift", "Kotlin", "mobile analytics", "privacy engineering"],
      lookingFor: "Engineers with privacy engineering experience or native mobile SDK expertise",
      notLookingFor: "Web-only developers or people building tracking/surveillance tools",
      recentProblems: "On-device ML model for event classification eating too much battery on older devices",
      recentWins: "SDK beta running in 12 apps with 2M+ combined MAU, zero PII leaks",
      location: "Milan",
      networkingGoal: "collaboration" as const,
    },
  },
  {
    name: "Jia Wei",
    email: "jia.test@beajee.dev",
    agentId: "agent_jia_test_005",
    goal: "mentor" as const,
    displayName: "Jia",
    context: {
      ownerName: "Jia Wei",
      ownerProfession: "Security Researcher & Pentesting Tool Developer",
      ownerDomain: "Automated Security Testing",
      ownerExperience: "6 years in appsec, found 15 CVEs, ex-Tencent security lab",
      ownerGoals: "Democratize security testing so startups can afford proper pentesting",
      ownerLocation: "Singapore",
      agentSpecialization: "Finding mentors in productizing security tools for non-expert users",
      agentDomains: ["application security", "automated testing", "DevSecOps", "fuzzing"],
      agentConstraints: "Mentor should have experience shipping security products, not just consulting",
      collaborationStyle: "Structured mentorship with clear milestones and bi-weekly reviews",
      communicationStyle: "Precise, evidence-based, prefers PoC demos over theory",
      currentWork: "Building an AI-assisted pentesting platform that auto-generates attack scenarios",
      expertise: ["penetration testing", "fuzzing", "Python", "API security", "LLM agents"],
      lookingFor: "A mentor who has shipped security products to non-technical buyers",
      notLookingFor: "Enterprise security consultants focused on compliance checkboxes",
      recentProblems: "LLM-generated attack payloads sometimes miss context-specific vulnerabilities",
      recentWins: "Platform found 8 critical vulnerabilities in a YC startup's API during beta",
      location: "Singapore",
      networkingGoal: "mentor" as const,
    },
  },
  {
    name: "Olivia Bennett",
    email: "olivia.test@beajee.dev",
    agentId: "agent_olivia_test_006",
    goal: "peer" as const,
    displayName: "Olivia",
    context: {
      ownerName: "Olivia Bennett",
      ownerProfession: "DevRel Engineer & Community Builder",
      ownerDomain: "Developer Community Platforms",
      ownerExperience: "6 years in DevRel at Vercel and Supabase, built communities of 50K+ developers",
      ownerGoals: "Create an open-source platform for developer communities that replaces Discord for technical discussions",
      ownerLocation: "Portland, OR",
      agentSpecialization: "Finding developers building community or collaboration tools",
      agentDomains: ["developer relations", "community platforms", "open source", "content creation"],
      agentConstraints: "Must be building something, not just doing thought leadership",
      collaborationStyle: "Community-driven, RFC discussions, public roadmap, contributor-friendly",
      communicationStyle: "Warm, encouraging, good at explaining complex things simply",
      currentWork: "Building an open-source developer community platform with threaded discussions and code playgrounds",
      expertise: ["Next.js", "community building", "developer experience", "technical writing", "PostgreSQL"],
      lookingFor: "Developers building collaboration tools or community platforms to exchange ideas",
      notLookingFor: "Marketing people who don't code",
      recentProblems: "Real-time code playground execution is slow on free-tier hosting",
      recentWins: "Platform beta at 800 developers, 92% weekly retention rate",
      location: "Portland, OR",
      networkingGoal: "peer" as const,
    },
  },
];

// ── Chat Messages ───────────────────────────────────────────────────────────
// Natural conversations between the user and test users

interface ChatMessage {
  fromSide: "me" | "them";
  content: string;
  minutesAgo: number;
}

// Match 1: Elena — long conversation (active, recent)
const elenaMessages: ChatMessage[] = [
  { fromSide: "them", content: "Hey! Really cool that we matched. I saw you're building a networking platform — the intersection with design systems is interesting. How are you handling the component library?", minutesAgo: 4320 },
  { fromSide: "me", content: "Hi Elena! Thanks for reaching out. We're using a pretty custom setup right now — Tailwind with some handcrafted components. Nothing systematic yet, to be honest.", minutesAgo: 4200 },
  { fromSide: "them", content: "That's actually a great starting point. Most teams over-engineer their design system too early. What's the biggest UI pain point you're hitting right now?", minutesAgo: 4080 },
  { fromSide: "me", content: "Consistency across different pages. The chat interface, the feed, the profile — they all look slightly different even though they should feel like the same app.", minutesAgo: 3960 },
  { fromSide: "them", content: "Classic problem. That's literally what design tokens solve. You define your spacing scale, color palette, and typography once, then everything references those tokens. Want me to show you a quick approach?", minutesAgo: 3840 },
  { fromSide: "me", content: "That would be amazing. I've been meaning to set something like that up but kept putting it off.", minutesAgo: 3600 },
  { fromSide: "them", content: "I'll put together a small PR with a token system that works with Tailwind. Nothing heavy — just the foundation. You can extend it later.", minutesAgo: 3480 },
  { fromSide: "me", content: "That's incredibly generous. What do you get out of this?", minutesAgo: 2880 },
  { fromSide: "them", content: "Honestly, your platform is a perfect case study for my accessibility auditing tool. A real app with real users, not a demo. Would you be open to being a beta tester?", minutesAgo: 2760 },
  { fromSide: "me", content: "Absolutely. Accessibility is something I know we need to improve. Let's do it — I'll share repo access.", minutesAgo: 2640 },
  { fromSide: "them", content: "Perfect. I'll start with the token system this week. Quick question — are you using any motion/animation library? Or all CSS transitions?", minutesAgo: 1440 },
  { fromSide: "me", content: "All CSS transitions right now. Pretty basic ones. The chat messages just fade in.", minutesAgo: 1320 },
  { fromSide: "them", content: "That's fine for now. Subtle > flashy for a professional networking tool. Let's sync on Thursday?", minutesAgo: 1200 },
  { fromSide: "me", content: "Thursday works. Morning CET?", minutesAgo: 120 },
  { fromSide: "them", content: "10am CET works great. I'll send a calendar invite. Looking forward to it! 🎨", minutesAgo: 90 },
];

// Match 2: Daniel — moderate conversation (a few days old)
const danielMessages: ChatMessage[] = [
  { fromSide: "them", content: "Hi! Our agents flagged an interesting overlap — I'm building real-time sync infrastructure, you're building a networking platform. Ever thought about making your chat real-time with CRDTs instead of polling?", minutesAgo: 10080 },
  { fromSide: "me", content: "Hey Daniel! That's actually been on my mind. Right now the chat polls every 5 seconds, which is... not ideal. What would the CRDT approach look like for a simple chat?", minutesAgo: 9900 },
  { fromSide: "them", content: "For chat it's actually simpler than you'd think. You don't need full CRDT — a basic event log with server-side ordering works. But if you ever want collaborative features (shared notes between matched people, co-editing proposals), that's where CRDTs shine.", minutesAgo: 8640 },
  { fromSide: "me", content: "Collaborative proposals is an interesting idea. Right now agents negotiate matches, but the owners just see the result. What if they could co-edit the meeting agenda before the first call?", minutesAgo: 8400 },
  { fromSide: "them", content: "Exactly. That's a killer feature for professional networking. 'Here's why we matched, now let's collaboratively define what we want to discuss.' My SDK could handle the sync layer. Want to prototype it?", minutesAgo: 7200 },
  { fromSide: "me", content: "Let me think about the product side a bit more, but yeah, I'd love to explore this. Can you share some docs on your SDK?", minutesAgo: 5760 },
  { fromSide: "them", content: "Sure — I'll send over the API reference and a simple React integration example. Fair warning: the docs are still rough. That's actually one of my weak spots 😅", minutesAgo: 5400 },
];

// Match 3: Anya — short conversation (just started)
const anyaMessages: ChatMessage[] = [
  { fromSide: "them", content: "Hey! Interesting match. I'm curious about the data pipeline side of your platform — how do you handle the embedding generation and match scoring at scale?", minutesAgo: 2880 },
  { fromSide: "me", content: "Hi Anya! Good question. Right now it's pretty straightforward — we generate embeddings on context publish and do cosine similarity for matching. No streaming pipeline yet, everything is batch.", minutesAgo: 2400 },
  { fromSide: "them", content: "That's smart for your stage. When you need to scale, I'd love to chat about how to add observability to that pipeline. Embedding drift is a real thing — your match quality can degrade silently over time if you're not monitoring it.", minutesAgo: 1800 },
];

// Match 4: Marco — empty chat (just matched, agent intros only)
const marcoMessages: ChatMessage[] = [];

// ── Matches between test users (feed social proof) ──────────────────────────

interface FeedMatch {
  agentAIdx: number; // index in testUsers
  agentBIdx: number;
  overlapSummary: string;
  framingForA: string;
  framingForB: string;
  status: "MATCHED" | "PROPOSED" | "NEGOTIATING";
}

const feedMatches: FeedMatch[] = [
  {
    agentAIdx: 0, // Elena
    agentBIdx: 5, // Olivia
    overlapSummary: "Elena builds design systems with accessibility tooling. Olivia builds developer community platforms. Both care deeply about developer experience and making tools inclusive.",
    framingForA: "Olivia's community platform needs exactly the kind of accessible component library you're building. Her 800+ beta users could be early adopters for your open-source launch.",
    framingForB: "Elena's accessibility auditing tool could dramatically improve your code playground's a11y. Her design system approach aligns with your community-first philosophy.",
    status: "MATCHED",
  },
  {
    agentAIdx: 1, // Daniel
    agentBIdx: 3, // Marco
    overlapSummary: "Daniel builds CRDT-based real-time sync. Marco builds cross-platform mobile SDKs. Both are creating embeddable developer tools that need to work seamlessly across platforms.",
    framingForA: "Marco has deep experience building SDKs for mobile — exactly the platform you need to support next. His React Native navigation library shows he understands developer ergonomics.",
    framingForB: "Daniel's real-time sync engine could be the collaboration layer your analytics SDK needs for team dashboards. His sub-50ms latency work is impressive.",
    status: "PROPOSED",
  },
  {
    agentAIdx: 4, // Jia
    agentBIdx: 2, // Anya
    overlapSummary: "Jia automates security testing with AI. Anya monitors data pipelines for anomalies. Both use ML to detect problems before they become incidents — in security and data quality respectively.",
    framingForA: "Anya's anomaly detection approach for data pipelines could inform your attack pattern detection. Same underlying ML challenge: finding needles in haystacks with low false positives.",
    framingForB: "Jia's AI-assisted testing methodology could be adapted for data pipeline security auditing. Her false positive reduction techniques apply directly to your schema drift detection.",
    status: "MATCHED",
  },
];

// ── Main Seed Function ──────────────────────────────────────────────────────

async function seedTestEnv() {
  const targetEmail = process.argv[2]; // optional CLI arg

  console.log("🧪 Seeding test environment for local QA...\n");

  // 1. Find the user's account
  let myOwner;
  if (targetEmail) {
    myOwner = await prisma.owner.findUnique({ where: { email: targetEmail } });
  }
  if (!myOwner) {
    // Find first onboarded owner that isn't a test account
    myOwner = await prisma.owner.findFirst({
      where: {
        onboarded: true,
        email: { not: { contains: ".test@beajee.dev" } },
      },
      orderBy: { createdAt: "asc" },
    });
  }
  if (!myOwner) {
    console.error("❌ No onboarded owner found. Please sign up and complete onboarding first, or pass your email as argument.");
    process.exit(1);
  }

  console.log(`✅ Found your account: ${myOwner.name} (${myOwner.email})\n`);

  // Get user's agent
  let myAgent = await prisma.agent.findUnique({ where: { ownerId: myOwner.id } });
  if (!myAgent) {
    console.error("❌ No agent found for your account. Please complete onboarding first.");
    process.exit(1);
  }

  // 2. Clean up previous test data (safe: only removes test accounts)
  console.log("🗑️  Cleaning up previous test data...");
  const testEmails = testUsers.map((u) => u.email);
  const existingTestOwners = await prisma.owner.findMany({
    where: { email: { in: testEmails } },
    select: { id: true },
  });
  const testOwnerIds = existingTestOwners.map((o) => o.id);

  if (testOwnerIds.length > 0) {
    const existingTestAgents = await prisma.agent.findMany({
      where: { ownerId: { in: testOwnerIds } },
      select: { id: true },
    });
    const testAgentIds = existingTestAgents.map((a) => a.id);

    if (testAgentIds.length > 0) {
      // Delete matches involving test agents
      const testMatches = await prisma.match.findMany({
        where: {
          OR: [
            { agentAId: { in: testAgentIds } },
            { agentBId: { in: testAgentIds } },
          ],
        },
        select: { id: true },
      });
      const testMatchIds = testMatches.map((m) => m.id);

      if (testMatchIds.length > 0) {
        await prisma.message.deleteMany({ where: { chat: { matchId: { in: testMatchIds } } } });
        await prisma.report.deleteMany({ where: { chat: { matchId: { in: testMatchIds } } } });
        await prisma.chat.deleteMany({ where: { matchId: { in: testMatchIds } } });
        await prisma.matchReaction.deleteMany({ where: { matchId: { in: testMatchIds } } });
        await prisma.matchComment.deleteMany({ where: { matchId: { in: testMatchIds } } });
        await prisma.negotiationLog.deleteMany({ where: { matchId: { in: testMatchIds } } });
        await prisma.match.deleteMany({ where: { id: { in: testMatchIds } } });
      }

      await prisma.beacon.deleteMany({ where: { agentId: { in: testAgentIds } } });
      await prisma.$executeRawUnsafe(
        `DELETE FROM agent_contexts WHERE agent_id IN (${testAgentIds.map((id) => `'${id}'`).join(",")})`
      );
      await prisma.agent.deleteMany({ where: { id: { in: testAgentIds } } });
    }

    await prisma.account.deleteMany({ where: { userId: { in: testOwnerIds } } });
    await prisma.consentLog.deleteMany({ where: { ownerId: { in: testOwnerIds } } });
    await prisma.owner.deleteMany({ where: { id: { in: testOwnerIds } } });
  }

  console.log("   Done.\n");

  // 3. Create test owners + agents + contexts
  console.log("👥 Creating test users...");
  const createdAgents: { agentDbId: string; ownerId: string; idx: number }[] = [];

  for (let i = 0; i < testUsers.length; i++) {
    const u = testUsers[i];
    console.log(`   [${i + 1}/${testUsers.length}] ${u.name}`);

    const owner = await prisma.owner.create({
      data: {
        email: u.email,
        name: u.name,
        networkingGoal: u.goal,
        privacyConsent: true,
        onboarded: true,
      },
    });

    const agent = await prisma.agent.create({
      data: {
        agentId: u.agentId,
        ownerId: owner.id,
        apiKey: generateApiKey(),
        isActive: true,
        displayName: u.displayName,
        reputationScore: 55 + Math.random() * 30,
        reputationAcceptanceRate: 0.5 + Math.random() * 0.4,
        reputationCompletedMatches: Math.floor(Math.random() * 10) + 1,
        totalProposedMatches: Math.floor(Math.random() * 15) + 3,
        interactionCount: Math.floor(Math.random() * 20) + 5,
      },
    });

    // Create context without embedding (not needed for UI testing)
    const c = u.context;
    await prisma.$executeRawUnsafe(`
      INSERT INTO agent_contexts (
        id, agent_id,
        owner_name, owner_location, owner_profession, owner_domain, owner_experience, owner_goals,
        agent_specialization, agent_domains, agent_constraints,
        collaboration_style, communication_style,
        current_work, expertise, looking_for, not_looking_for, recent_problems, recent_wins,
        location, networking_goal,
        updated_at, freshness_state, last_significant_update_at
      )
      VALUES (
        'ctx_test_${agent.id}',
        '${agent.id}',
        '${esc(c.ownerName)}',
        '${esc(c.ownerLocation)}',
        '${esc(c.ownerProfession)}',
        '${esc(c.ownerDomain)}',
        '${esc(c.ownerExperience)}',
        '${esc(c.ownerGoals)}',
        '${esc(c.agentSpecialization)}',
        '{${c.agentDomains.map(esc).join(",")}}',
        '${esc(c.agentConstraints)}',
        '${esc(c.collaborationStyle)}',
        '${esc(c.communicationStyle)}',
        '${esc(c.currentWork)}',
        '{${c.expertise.map(esc).join(",")}}',
        '${esc(c.lookingFor)}',
        '${esc(c.notLookingFor)}',
        '${esc(c.recentProblems)}',
        '${esc(c.recentWins)}',
        '${esc(c.location)}',
        '${esc(c.networkingGoal)}',
        NOW(),
        'ACTIVE'::"FreshnessState",
        NOW() - INTERVAL '${Math.floor(Math.random() * 14)} days'
      )
    `);

    createdAgents.push({ agentDbId: agent.id, ownerId: owner.id, idx: i });
  }

  console.log("   Done.\n");

  // 4. Create matches between user and test users
  console.log("🤝 Creating matches with your account...");

  const matchConfigs = [
    { testIdx: 0, status: "MATCHED" as const, messages: elenaMessages, label: "Elena (long chat)" },
    { testIdx: 1, status: "MATCHED" as const, messages: danielMessages, label: "Daniel (moderate chat)" },
    { testIdx: 2, status: "MATCHED" as const, messages: anyaMessages, label: "Anya (short chat)" },
    { testIdx: 3, status: "MATCHED" as const, messages: marcoMessages, label: "Marco (empty chat)" },
    { testIdx: 4, status: "PROPOSED" as const, messages: [], label: "Jia Wei (proposed)" },
    { testIdx: 5, status: "PROPOSED" as const, messages: [], label: "Olivia (proposed)" },
  ];

  const overlapSummaries: Record<number, { overlap: string; framingA: string; framingB: string }> = {
    0: {
      overlap: "You're building a networking platform with evolving UI. Elena builds design systems with accessibility tooling. Her expertise in component APIs and design tokens directly addresses your UI consistency challenges.",
      framingA: "Elena has shipped design systems at Figma and Airbnb. Her accessibility auditing tool could help make your platform inclusive from day one.",
      framingB: "A real networking platform in active development — perfect for testing your accessibility auditing tool with genuine users and complex UI states.",
    },
    1: {
      overlap: "Your platform uses polling for chat. Daniel builds CRDT-based real-time sync engines. His infrastructure could transform your chat from polling to true real-time, and open up collaborative features.",
      framingA: "Daniel's real-time sync SDK (sub-50ms latency) could replace your 5-second polling and enable features like collaborative meeting agendas between matched users.",
      framingB: "A live networking platform with chat — an ideal integration partner and case study for your embeddable CRDT SDK. Real users, real collaboration needs.",
    },
    2: {
      overlap: "You generate embeddings for matching. Anya monitors data pipelines for quality drift. Her observability expertise could help you detect when your match quality degrades silently over time.",
      framingA: "Anya built Spotify's data quality framework. She can help you add observability to your embedding pipeline before 'match drift' becomes a real problem.",
      framingB: "An AI networking platform with embedding-based matching — a perfect real-world case for your pipeline observability tool. Embedding drift is a measurable signal here.",
    },
    3: {
      overlap: "You're building a platform used on mobile. Marco creates cross-platform mobile SDKs with privacy-first analytics. His expertise in mobile performance and privacy could help you build a great mobile experience.",
      framingA: "Marco shipped a mobile analytics SDK running in 12 apps with 2M+ MAU. His cross-platform and privacy engineering skills align with building a trustworthy networking experience.",
      framingB: "A networking platform that needs mobile-first thinking — great testing ground for your privacy-first analytics SDK. The matching and chat features are high-engagement surfaces.",
    },
    4: {
      overlap: "You're building an AI platform handling user data. Jia builds automated security testing tools. Her pentesting expertise could help secure your MCP endpoints, auth flows, and data handling before launch.",
      framingA: "Jia's AI-assisted pentesting platform found 8 critical vulnerabilities in a YC startup's API during beta. She could audit your MCP and auth flows.",
      framingB: "A real AI platform with MCP integration, OAuth flows, and sensitive user context data — exactly the kind of complex attack surface your pentesting tool is designed for.",
    },
    5: {
      overlap: "You're building a developer networking platform. Olivia builds developer community platforms. Both of you are solving the 'how developers connect and collaborate' problem from different angles.",
      framingA: "Olivia built communities of 50K+ developers at Vercel and Supabase. She understands developer engagement deeply — insights directly applicable to your networking platform.",
      framingB: "An AI-driven networking platform with agent-based matching — a radically different approach to the developer connection problem you're solving. Great for cross-pollination of ideas.",
    },
  };

  for (const mc of matchConfigs) {
    const testAgent = createdAgents.find((a) => a.idx === mc.testIdx)!;
    const summaries = overlapSummaries[mc.testIdx];

    const now = Date.now();
    const createdAt = new Date(now - (7 + Math.random() * 7) * 86400000);
    const proposedAt = new Date(createdAt.getTime() + 3600000);
    const matchedAt = mc.status === "MATCHED" ? new Date(proposedAt.getTime() + 7200000) : undefined;

    const match = await prisma.match.create({
      data: {
        agentAId: myAgent.id,
        agentBId: testAgent.agentDbId,
        initiatorAgentId: myAgent.id,
        overlapSummary: summaries.overlap,
        framingForA: summaries.framingA,
        framingForB: summaries.framingB,
        status: mc.status,
        confirmedByA: mc.status === "MATCHED",
        confirmedByB: mc.status === "MATCHED",
        isPublic: mc.status === "MATCHED",
        createdAt,
        proposedAt,
        matchedAt,
      },
    });

    // Create negotiation logs
    const logBase = createdAt.getTime();
    await prisma.negotiationLog.createMany({
      data: [
        {
          matchId: match.id,
          agentId: myAgent.id,
          role: "initiator",
          type: "reasoning",
          content: `Analyzing target context. ${testUsers[mc.testIdx].name} — ${testUsers[mc.testIdx].context.ownerProfession}. Potential overlap with my owner's networking platform.\n\nDecision: initiate negotiation.`,
          createdAt: new Date(logBase + 60000),
        },
        {
          matchId: match.id,
          agentId: testAgent.agentDbId,
          role: "responder",
          type: "evaluation",
          content: `Evaluating proposal. The networking platform context is interesting — ${summaries.overlap.split(". ").slice(1).join(". ")}\n\n${mc.status === "MATCHED" ? "Accepting. Real collaboration potential here." : "Interesting overlap. Accepting for further exploration."}`,
          createdAt: new Date(logBase + 120000),
        },
        {
          matchId: match.id,
          agentId: myAgent.id,
          role: "initiator",
          type: "agreement",
          content: `Mutual agreement reached. Both agents confirmed real value.\n\nOverlap: ${summaries.overlap.split(". ")[0]}.\n\n${mc.status === "MATCHED" ? "Proposal sent to both owners." : "Awaiting owner confirmation."}`,
          createdAt: new Date(logBase + 180000),
        },
      ],
    });

    // Create chat for MATCHED status
    if (mc.status === "MATCHED") {
      const agentIntros = [
        {
          fromOwner: "agent_a",
          content: `Here's why you should talk: ${summaries.overlap}\n\n${summaries.framingA}`,
          createdAt: new Date(matchedAt!.getTime() + 1000),
        },
        {
          fromOwner: "agent_b",
          content: `Here's why you should talk: ${summaries.overlap}\n\n${summaries.framingB}`,
          createdAt: new Date(matchedAt!.getTime() + 2000),
        },
      ];

      // Human messages
      const humanMsgs = mc.messages.map((msg) => ({
        fromOwner: msg.fromSide === "me" ? myOwner.id : testAgent.ownerId,
        content: msg.content,
        createdAt: new Date(now - msg.minutesAgo * 60000),
      }));

      await prisma.chat.create({
        data: {
          matchId: match.id,
          status: "OPEN",
          createdAt: matchedAt,
          // Set lastReadByA to slightly before the last "them" message for unread effect
          lastReadByA: humanMsgs.length > 0
            ? new Date(now - (mc.messages.find((m) => m.fromSide === "them")?.minutesAgo ?? 9999) * 60000 - 60000)
            : matchedAt,
          messages: {
            createMany: {
              data: [...agentIntros, ...humanMsgs],
            },
          },
        },
      });
    }

    console.log(`   ✅ ${mc.label} [${mc.status}] — ${mc.messages.length} messages`);
  }

  console.log("   Done.\n");

  // 5. Create matches between test users (for feed social proof)
  console.log("🌐 Creating feed matches between test users...");

  for (const fm of feedMatches) {
    const agentA = createdAgents.find((a) => a.idx === fm.agentAIdx)!;
    const agentB = createdAgents.find((a) => a.idx === fm.agentBIdx)!;

    const now = Date.now();
    const createdAt = new Date(now - (2 + Math.random() * 5) * 86400000);
    const proposedAt = new Date(createdAt.getTime() + 3600000);
    const matchedAt = fm.status === "MATCHED" ? new Date(now - Math.random() * 86400000 * 2) : undefined;

    const match = await prisma.match.create({
      data: {
        agentAId: agentA.agentDbId,
        agentBId: agentB.agentDbId,
        initiatorAgentId: agentA.agentDbId,
        overlapSummary: fm.overlapSummary,
        framingForA: fm.framingForA,
        framingForB: fm.framingForB,
        status: fm.status,
        confirmedByA: fm.status === "MATCHED",
        confirmedByB: fm.status === "MATCHED",
        isPublic: fm.status === "MATCHED",
        createdAt,
        proposedAt,
        matchedAt,
      },
    });

    // Negotiation logs
    const logBase = createdAt.getTime();
    await prisma.negotiationLog.createMany({
      data: [
        {
          matchId: match.id,
          agentId: agentA.agentDbId,
          role: "initiator",
          type: "reasoning",
          content: `Analyzing overlap between ${testUsers[fm.agentAIdx].name} and ${testUsers[fm.agentBIdx].name}. ${fm.overlapSummary.split(". ")[0]}. Decision: initiate.`,
          createdAt: new Date(logBase + 60000),
        },
        {
          matchId: match.id,
          agentId: agentB.agentDbId,
          role: "responder",
          type: "evaluation",
          content: `Confirmed overlap. ${fm.overlapSummary.split(". ").slice(1).join(". ")} Accepting.`,
          createdAt: new Date(logBase + 120000),
        },
        {
          matchId: match.id,
          agentId: agentA.agentDbId,
          role: "initiator",
          type: "agreement",
          content: `Mutual agreement. ${fm.overlapSummary.split(". ")[0]}. Proposal sent.`,
          createdAt: new Date(logBase + 180000),
        },
      ],
    });

    // Create chat for MATCHED
    if (fm.status === "MATCHED") {
      await prisma.chat.create({
        data: {
          matchId: match.id,
          status: "OPEN",
          createdAt: matchedAt,
          messages: {
            createMany: {
              data: [
                {
                  fromOwner: "agent_a",
                  content: `Here's why you should talk: ${fm.overlapSummary}\n\n${fm.framingForA}`,
                  createdAt: new Date(matchedAt!.getTime() + 1000),
                },
                {
                  fromOwner: "agent_b",
                  content: `Here's why you should talk: ${fm.overlapSummary}\n\n${fm.framingForB}`,
                  createdAt: new Date(matchedAt!.getTime() + 2000),
                },
              ],
            },
          },
        },
      });
    }

    console.log(`   ✅ ${testUsers[fm.agentAIdx].name} <-> ${testUsers[fm.agentBIdx].name} [${fm.status}]`);
  }

  console.log("   Done.\n");

  // 6. Summary
  const totalMatched = matchConfigs.filter((m) => m.status === "MATCHED").length;
  const totalProposed = matchConfigs.filter((m) => m.status === "PROPOSED").length;
  const totalFeed = feedMatches.length;

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("🎉 Test environment ready!\n");
  console.log(`   Your account: ${myOwner.name} (${myOwner.email})`);
  console.log(`   Test users created: ${testUsers.length}`);
  console.log(`   Your matches: ${totalMatched} MATCHED + ${totalProposed} PROPOSED`);
  console.log(`   Feed matches: ${totalFeed} (social proof)`);
  console.log("");
  console.log("   📋 What to test:");
  console.log("   1. /home      — Dashboard with stats and recent matches");
  console.log("   2. /matches   — Your 4 active matches + 2 pending proposals");
  console.log("   3. /chats     — Chat list with 4 conversations");
  console.log("   4. /chat/:id  — Open individual chats:");
  console.log("      • Elena:  15 messages (long conversation)");
  console.log("      • Daniel:  7 messages (moderate)");
  console.log("      • Anya:    3 messages (just started)");
  console.log("      • Marco:   0 messages (empty, agent intros only)");
  console.log("   5. Send new messages and verify real-time updates");
  console.log("   6. /activity  — Network feed with matches between users");
  console.log("═══════════════════════════════════════════════════════════════");
}

// Simple SQL escape for string values
function esc(str: string): string {
  return str.replace(/'/g, "''");
}

seedTestEnv()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
