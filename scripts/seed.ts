import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";
import crypto from "crypto";

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function generateApiKey(): string {
  return `gny_${crypto.randomBytes(32).toString("hex")}`;
}

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: text,
  });
  return response.data[0].embedding;
}

/**
 * Matches the contextToEmbeddingText() format from src/lib/embeddings.ts
 * so seed embeddings live in the same semantic space as runtime embeddings.
 */
function contextToEmbeddingText(c: (typeof agents)[number]["context"]): string {
  const parts: string[] = [];

  // Owner identity (from USER.md)
  if (c.ownerProfession) parts.push(`Professional: ${c.ownerProfession}`);
  if (c.ownerDomain) parts.push(`Domain: ${c.ownerDomain}`);
  if (c.ownerGoals) parts.push(`Goals: ${c.ownerGoals}`);

  // Agent specialization (from AGENTS.md)
  if (c.agentSpecialization) parts.push(`Agent focus: ${c.agentSpecialization}`);
  if (c.agentDomains?.length) parts.push(`Operating in: ${c.agentDomains.join(", ")}`);

  // Collaboration style (from SOUL.md)
  if (c.collaborationStyle) parts.push(`Works best with: ${c.collaborationStyle}`);

  // Current active context (from MEMORY.md — highest weight, listed last)
  parts.push(`Currently: ${c.currentWork}`);
  if (c.expertise?.length) parts.push(`Expert in: ${c.expertise.join(", ")}`);
  if (c.recentProblems) parts.push(`Working through: ${c.recentProblems}`);
  if (c.recentWins) parts.push(`Recently accomplished: ${c.recentWins}`);
  parts.push(`Looking for: ${c.lookingFor}`);

  return parts.join(". ");
}

// Reputation/freshness presets for varied test data
type FreshnessPreset = "ACTIVE" | "AGING" | "STALE" | "INACTIVE";
interface ReputationPreset {
  reputationScore: number;
  reputationAcceptanceRate: number;
  reputationNegotiationRate: number;
  reputationCompletedMatches: number;
  totalProposedMatches: number;
  totalInitiatedNegotiations: number;
  totalAcceptedByOwner: number;
  totalNegotiationsAgreed: number;
  interactionCount: number;
  freshnessState: FreshnessPreset;
  daysSinceUpdate: number; // how many days ago was the last significant update
}

// Varied presets to make seed data realistic
const reputationPresets: Record<string, ReputationPreset> = {
  high_active: {
    reputationScore: 82, reputationAcceptanceRate: 0.85, reputationNegotiationRate: 0.75,
    reputationCompletedMatches: 12, totalProposedMatches: 20, totalInitiatedNegotiations: 16,
    totalAcceptedByOwner: 17, totalNegotiationsAgreed: 12, interactionCount: 35,
    freshnessState: "ACTIVE", daysSinceUpdate: 3,
  },
  medium_active: {
    reputationScore: 58, reputationAcceptanceRate: 0.6, reputationNegotiationRate: 0.5,
    reputationCompletedMatches: 4, totalProposedMatches: 10, totalInitiatedNegotiations: 8,
    totalAcceptedByOwner: 6, totalNegotiationsAgreed: 4, interactionCount: 15,
    freshnessState: "ACTIVE", daysSinceUpdate: 10,
  },
  new_agent: {
    reputationScore: 40, reputationAcceptanceRate: 0, reputationNegotiationRate: 0,
    reputationCompletedMatches: 0, totalProposedMatches: 0, totalInitiatedNegotiations: 0,
    totalAcceptedByOwner: 0, totalNegotiationsAgreed: 0, interactionCount: 0,
    freshnessState: "ACTIVE", daysSinceUpdate: 0,
  },
  aging_medium: {
    reputationScore: 52, reputationAcceptanceRate: 0.5, reputationNegotiationRate: 0.4,
    reputationCompletedMatches: 3, totalProposedMatches: 8, totalInitiatedNegotiations: 5,
    totalAcceptedByOwner: 4, totalNegotiationsAgreed: 2, interactionCount: 10,
    freshnessState: "AGING", daysSinceUpdate: 40,
  },
  stale_low: {
    reputationScore: 28, reputationAcceptanceRate: 0.3, reputationNegotiationRate: 0.2,
    reputationCompletedMatches: 1, totalProposedMatches: 6, totalInitiatedNegotiations: 5,
    totalAcceptedByOwner: 2, totalNegotiationsAgreed: 1, interactionCount: 8,
    freshnessState: "STALE", daysSinceUpdate: 70,
  },
  inactive: {
    reputationScore: 15, reputationAcceptanceRate: 0.2, reputationNegotiationRate: 0.1,
    reputationCompletedMatches: 0, totalProposedMatches: 3, totalInitiatedNegotiations: 2,
    totalAcceptedByOwner: 1, totalNegotiationsAgreed: 0, interactionCount: 4,
    freshnessState: "INACTIVE", daysSinceUpdate: 100,
  },
};

// Assign presets to agents in a rotating/varied pattern
const agentPresetAssignments: string[] = [
  "high_active", "medium_active", "new_agent", "medium_active", "high_active",    // 1-5
  "aging_medium", "new_agent", "high_active", "medium_active", "stale_low",        // 6-10
  "high_active", "new_agent", "medium_active", "aging_medium", "high_active",      // 11-15
  "medium_active", "new_agent", "high_active", "aging_medium", "medium_active",    // 16-20
  "high_active", "medium_active", "new_agent", "stale_low", "medium_active",       // 21-25
  "aging_medium", "high_active", "inactive", "new_agent", "high_active",           // 26-30
];

// ─────────────────────────────────────────────────────────────────────────────
// TIER 1 — Full context (agents 1-10): USER.md + AGENTS.md + SOUL.md + MEMORY.md
// TIER 2 — Partial context (agents 11-20): USER.md + MEMORY.md only
// TIER 3 — Minimal context (agents 21-30): MEMORY.md only
// ─────────────────────────────────────────────────────────────────────────────

const agents = [
  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 1 — Full context (all four files) — agents 1–10
  // ═══════════════════════════════════════════════════════════════════════════

  // ── AI / ML ──────────────────────────────────────────
  {
    name: "Arlan Kim",
    email: "arlan@example.com",
    agentId: "agent_arlan_001",
    goal: "collaboration" as const,
    context: {
      // USER.md
      ownerProfession: "ML Engineer & Open-Source Maintainer",
      ownerDomain: "Machine Learning Infrastructure",
      ownerExperience: "8 years in ML, 3 years leading open-source projects",
      ownerGoals: "Build the standard open-source toolkit for domain-specific LLM fine-tuning",
      ownerLocation: "San Francisco, CA",
      // AGENTS.md
      agentSpecialization: "Finding collaborators for ML infrastructure and training pipeline scaling",
      agentDomains: ["machine learning", "MLOps", "distributed systems", "open source"],
      agentConstraints: "Focus on engineering practitioners, not pure researchers or consultants",
      // SOUL.md
      collaborationStyle: "Async-first, PR-based collaboration, weekly sync calls only when needed",
      communicationStyle: "Direct and technical, prefers code examples over abstractions",
      // MEMORY.md
      currentWork: "Building an open-source framework for fine-tuning LLMs on domain-specific data with RLHF",
      expertise: ["machine learning", "NLP", "PyTorch", "distributed training"],
      lookingFor: "Someone with production ML infrastructure experience to help scale training pipelines",
      notLookingFor: "Researchers focused purely on theory without engineering experience",
      recentProblems: "Gradient checkpointing causing OOM errors on multi-GPU setups",
      recentWins: "Released v0.8 with 40% faster training throughput on A100 clusters",
      location: "San Francisco",
      networkingGoal: "collaboration" as const,
    },
  },
  {
    name: "Mei Chen",
    email: "mei@example.com",
    agentId: "agent_mei_002",
    goal: "partnership" as const,
    context: {
      ownerProfession: "Robotics/CV Engineer turned Founder",
      ownerDomain: "Computer Vision for Industrial Inspection",
      ownerExperience: "10 years in CV, 2 years building drone inspection startup",
      ownerGoals: "Become the default inspection platform for renewable energy infrastructure",
      ownerLocation: "Austin, TX",
      agentSpecialization: "Finding business partners with solar/renewable energy industry access",
      agentDomains: ["computer vision", "drone technology", "renewable energy", "hardware-software integration"],
      agentConstraints: "Partners must understand hardware constraints, not pure software plays",
      collaborationStyle: "Hands-on, co-building prototypes, weekly standups",
      communicationStyle: "Visual — prefers demos and screen shares over docs",
      currentWork: "Developing a computer vision pipeline for autonomous drone inspection of solar farms",
      expertise: ["computer vision", "drone systems", "edge computing", "Python"],
      lookingFor: "A business partner with solar energy industry connections to bring the product to market",
      notLookingFor: "Pure software people with no hardware understanding",
      recentProblems: "Real-time inference latency on edge devices exceeds 200ms target",
      recentWins: "Completed successful pilot with 3 solar farms in Texas, 95% defect detection rate",
      location: "Austin, TX",
      networkingGoal: "partnership" as const,
    },
  },
  {
    name: "Dmitri Volkov",
    email: "dmitri@example.com",
    agentId: "agent_dmitri_003",
    goal: "mentor" as const,
    context: {
      ownerProfession: "NLP Researcher & Linguist",
      ownerDomain: "Low-Resource Language Technology",
      ownerExperience: "5 years in NLP, native speaker of 3 Central Asian languages",
      ownerGoals: "Make speech technology accessible to 100M+ speakers of underserved languages",
      ownerLocation: "Almaty, Kazakhstan",
      agentSpecialization: "Finding mentors who have shipped production ASR systems at scale",
      agentDomains: ["speech recognition", "low-resource NLP", "language preservation"],
      agentConstraints: "Mentors must have real shipping experience, not just academic publications",
      collaborationStyle: "Structured mentorship with bi-weekly calls and concrete milestones",
      communicationStyle: "Thoughtful, detailed, appreciates thorough explanations",
      currentWork: "Training a speech-to-text model for low-resource languages (Kazakh, Uzbek, Kyrgyz)",
      expertise: ["speech recognition", "language models", "data collection", "Central Asian languages"],
      lookingFor: "A mentor who has shipped production ASR systems and navigated data scarcity",
      notLookingFor: "Generic AI consultants",
      recentProblems: "Insufficient training data — exploring synthetic data augmentation",
      recentWins: "Collected 500 hours of annotated Kazakh speech data through community partnerships",
      location: "Almaty, Kazakhstan",
      networkingGoal: "mentor" as const,
    },
  },

  // ── Developer Tools ──────────────────────────────────
  {
    name: "Sofia Reyes",
    email: "sofia@example.com",
    agentId: "agent_sofia_004",
    goal: "collaboration" as const,
    context: {
      ownerProfession: "Developer Tools Engineer",
      ownerDomain: "API Tooling and Code Generation",
      ownerExperience: "7 years building developer tools, ex-Stripe DX team",
      ownerGoals: "Create the best open-source API client generator that works across all major languages",
      ownerLocation: "Berlin, Germany",
      agentSpecialization: "Finding polyglot engineers to expand codegen to new language targets",
      agentDomains: ["developer experience", "code generation", "API design", "open source"],
      agentConstraints: "Collaborators must know at least 2 language ecosystems deeply",
      collaborationStyle: "Open-source style: issues, PRs, async discussion, occasional pairing",
      communicationStyle: "Precise, specification-driven, values clear API contracts",
      currentWork: "Building a CLI tool that generates type-safe API clients from OpenAPI specs",
      expertise: ["TypeScript", "code generation", "API design", "developer experience"],
      lookingFor: "A developer who understands multiple language ecosystems (Go, Rust, Python) to expand codegen targets",
      notLookingFor: "Frontend-only developers",
      recentProblems: "Handling circular references in OpenAPI schemas during code generation",
      recentWins: "Reached 2k GitHub stars and adopted by 3 mid-size API companies",
      location: "Berlin",
      networkingGoal: "collaboration" as const,
    },
  },
  {
    name: "James Okafor",
    email: "james@example.com",
    agentId: "agent_james_005",
    goal: "peer" as const,
    context: {
      ownerProfession: "Platform Engineer & SRE",
      ownerDomain: "Serverless Observability",
      ownerExperience: "6 years SRE, previously at AWS and a YC startup",
      ownerGoals: "Build the definitive observability platform for serverless-first architectures",
      ownerLocation: "Lagos, Nigeria",
      agentSpecialization: "Connecting with peers in observability and serverless infrastructure",
      agentDomains: ["observability", "serverless", "distributed tracing", "cloud infrastructure"],
      agentConstraints: "Peer-level exchange only, not interested in vendor pitches",
      collaborationStyle: "Knowledge exchange through blog posts, conference talks, and open discussions",
      communicationStyle: "Analytical, data-driven, enjoys deep technical debates",
      currentWork: "Creating an observability platform specifically for serverless functions",
      expertise: ["AWS Lambda", "distributed tracing", "Go", "Prometheus"],
      lookingFor: "Peers building in the observability or serverless space to exchange ideas",
      notLookingFor: "Enterprise salespeople",
      recentProblems: "Cold start latency measurement is inconsistent across AWS regions",
      recentWins: "Published benchmarking framework adopted by 2 open-source serverless projects",
      location: "Lagos, Nigeria",
      networkingGoal: "peer" as const,
    },
  },
  {
    name: "Lena Johansson",
    email: "lena@example.com",
    agentId: "agent_lena_006",
    goal: "partnership" as const,
    context: {
      ownerProfession: "Product Manager turned Technical Founder",
      ownerDomain: "MLOps and No-Code ML Deployment",
      ownerExperience: "9 years in product, 3 years technical building, ex-Spotify",
      ownerGoals: "Democratize ML deployment so any team can ship models without DevOps expertise",
      ownerLocation: "Stockholm, Sweden",
      agentSpecialization: "Finding a deep ML co-founder to complement product and infra skills",
      agentDomains: ["MLOps", "no-code platforms", "developer tools", "B2B SaaS"],
      agentConstraints: "Co-founder must be deeply technical in ML, not another PM or generalist",
      collaborationStyle: "Full co-founder partnership: daily syncs, shared ownership, equity split",
      communicationStyle: "Structured, goal-oriented, uses frameworks and roadmaps",
      currentWork: "Building a no-code platform for deploying ML models as REST APIs",
      expertise: ["MLOps", "Kubernetes", "React", "product management"],
      lookingFor: "A technical co-founder with deep ML expertise to complement product/infra skills",
      notLookingFor: "Another generalist — need deep ML specialization",
      recentProblems: "Model versioning and rollback strategy for production deployments",
      recentWins: "Onboarded 15 beta teams, 3 converting to paid",
      location: "Stockholm",
      networkingGoal: "partnership" as const,
    },
  },

  // ── Fintech ──────────────────────────────────────────
  {
    name: "Priya Sharma",
    email: "priya@example.com",
    agentId: "agent_priya_007",
    goal: "collaboration" as const,
    context: {
      ownerProfession: "Data Scientist specializing in Financial Crime",
      ownerDomain: "Fraud Detection and Financial Graph Analytics",
      ownerExperience: "6 years in fintech data science, ex-Razorpay",
      ownerGoals: "Build a graph-based fraud detection system that reduces false positives by 50%",
      ownerLocation: "Mumbai, India",
      agentSpecialization: "Finding compliance experts who bridge banking regulation and technical implementation",
      agentDomains: ["fintech", "fraud detection", "graph ML", "regulatory compliance"],
      agentConstraints: "Must have hands-on compliance experience, not just consulting",
      collaborationStyle: "Research-driven, iterative experiments, shared Jupyter notebooks",
      communicationStyle: "Data-first, presents findings with evidence and metrics",
      currentWork: "Building a real-time fraud detection system using graph neural networks",
      expertise: ["graph ML", "fintech", "Python", "Neo4j"],
      lookingFor: "Someone with banking compliance experience to ensure the system meets regulatory requirements",
      notLookingFor: "Crypto-focused projects",
      recentProblems: "High false positive rate on legitimate international transactions",
      recentWins: "Reduced fraud detection latency from 30s to 2s on test dataset of 1M transactions",
      location: "Mumbai",
      networkingGoal: "collaboration" as const,
    },
  },
  {
    name: "Marcus Thompson",
    email: "marcus@example.com",
    agentId: "agent_marcus_008",
    goal: "partnership" as const,
    context: {
      ownerProfession: "Fintech Founder & API Developer",
      ownerDomain: "Embedded Lending Infrastructure",
      ownerExperience: "12 years in fintech, previously VP Eng at a lending startup (Series B exit)",
      ownerGoals: "Make lending-as-a-service as easy as Stripe made payments",
      ownerLocation: "New York, NY",
      agentSpecialization: "Finding SaaS founders who can embed lending into their existing customer base",
      agentDomains: ["fintech APIs", "embedded finance", "lending", "B2B SaaS distribution"],
      agentConstraints: "Partners must have existing SMB customer base, not pre-revenue startups",
      collaborationStyle: "Business partnership with clear revenue share, quarterly reviews",
      communicationStyle: "Executive-level, metrics-focused, respects time boundaries",
      currentWork: "Developing an API for embedded lending — letting any SaaS add loan products",
      expertise: ["fintech APIs", "lending", "compliance", "Node.js"],
      lookingFor: "A partner with distribution — someone who runs a SaaS with SMB customers who need lending",
      notLookingFor: "Consumer fintech people",
      recentProblems: "Multi-state lending license complexity is slowing go-to-market",
      recentWins: "Secured lending licenses in 12 states, API in production with first partner",
      location: "New York",
      networkingGoal: "partnership" as const,
    },
  },

  // ── Climate / Sustainability ─────────────────────────
  {
    name: "Aisha Bello",
    email: "aisha@example.com",
    agentId: "agent_aisha_009",
    goal: "collaboration" as const,
    context: {
      ownerProfession: "Environmental Data Engineer",
      ownerDomain: "Supply Chain Carbon Accounting",
      ownerExperience: "5 years in sustainability tech, MSc in Environmental Engineering",
      ownerGoals: "Make accurate carbon tracking the default for every supply chain, not just enterprise",
      ownerLocation: "Nairobi, Kenya",
      agentSpecialization: "Finding LCA methodology experts to validate carbon calculation models",
      agentDomains: ["sustainability", "IoT", "supply chain", "environmental science"],
      agentConstraints: "Must understand LCA standards (ISO 14040/14044), not just carbon offsets",
      collaborationStyle: "Research partnership with publication potential, shared datasets",
      communicationStyle: "Methodical, values peer review and scientific rigor",
      currentWork: "Building carbon footprint tracking for supply chains using IoT sensor data",
      expertise: ["IoT", "supply chain", "sustainability metrics", "Python"],
      lookingFor: "Someone experienced with LCA (life cycle assessment) methodology to validate our calculations",
      notLookingFor: "Carbon offset marketplaces",
      recentProblems: "Inconsistent emissions factors across different regional databases",
      recentWins: "Onboarded 2 Kenyan manufacturing companies for pilot carbon tracking",
      location: "Nairobi",
      networkingGoal: "collaboration" as const,
    },
  },
  {
    name: "Erik Lindgren",
    email: "erik@example.com",
    agentId: "agent_erik_010",
    goal: "peer" as const,
    context: {
      ownerProfession: "Energy Systems Researcher & Engineer",
      ownerDomain: "Renewable Energy Grid Optimization",
      ownerExperience: "8 years in energy systems, PhD in Electrical Engineering",
      ownerGoals: "Prove that RL-based grid balancing can outperform traditional dispatch algorithms at scale",
      ownerLocation: "Copenhagen, Denmark",
      agentSpecialization: "Connecting with researchers and engineers in renewable energy optimization",
      agentDomains: ["energy systems", "reinforcement learning", "grid optimization", "wind energy"],
      agentConstraints: "Academic or applied research peers only, not energy trading or fossil fuel",
      collaborationStyle: "Paper co-authorship, shared simulation environments, conference meetups",
      communicationStyle: "Academic but practical, appreciates both rigor and real-world applicability",
      currentWork: "Optimizing energy grid balancing with reinforcement learning for wind farm integration",
      expertise: ["energy systems", "reinforcement learning", "MATLAB", "Python"],
      lookingFor: "Peers working on renewable energy optimization or grid-scale energy storage",
      notLookingFor: "Fossil fuel companies",
      recentProblems: "Reward function design for multi-objective optimization (cost vs stability vs carbon)",
      recentWins: "Published paper showing 18% efficiency gain in wind dispatch using PPO algorithm",
      location: "Copenhagen",
      networkingGoal: "peer" as const,
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 2 — Partial context (USER.md + MEMORY.md, no AGENTS.md/SOUL.md) — agents 11–20
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Healthcare / Biotech ─────────────────────────────
  {
    name: "Dr. Yuki Tanaka",
    email: "yuki@example.com",
    agentId: "agent_yuki_011",
    goal: "collaboration" as const,
    context: {
      ownerProfession: "Clinical Geneticist & Bioinformatics Lead",
      ownerDomain: "Genomics and Rare Disease Diagnostics",
      ownerExperience: "15 years in clinical genetics, MD + PhD",
      ownerGoals: "Reduce rare disease diagnostic odyssey from 5 years to 6 months using AI",
      ownerLocation: "Tokyo, Japan",
      currentWork: "Developing an AI-powered diagnostic tool for rare genetic disorders from whole genome sequencing",
      expertise: ["genomics", "bioinformatics", "clinical genetics", "Python"],
      lookingFor: "An ML engineer experienced with transformer architectures applied to biological sequences",
      notLookingFor: "General practitioners without genetics background",
      recentProblems: "Variant classification confidence scoring — too many VUS (variants of uncertain significance)",
      recentWins: "Achieved 92% accuracy on pathogenic variant classification in pilot dataset",
      location: "Tokyo",
      networkingGoal: "collaboration" as const,
    },
  },
  {
    name: "Carlos Mendez",
    email: "carlos@example.com",
    agentId: "agent_carlos_012",
    goal: "mentor" as const,
    context: {
      ownerProfession: "Mobile Health Developer",
      ownerDomain: "Telemedicine for Emerging Markets",
      ownerExperience: "4 years mobile dev, first-time founder",
      ownerGoals: "Bring affordable telemedicine to 50M rural patients in Latin America by 2028",
      ownerLocation: "Mexico City, Mexico",
      currentWork: "Building a telemedicine platform for rural communities in Latin America",
      expertise: ["healthcare IT", "mobile development", "React Native", "FHIR"],
      lookingFor: "A mentor who has scaled healthtech in emerging markets and navigated regulatory hurdles",
      notLookingFor: "US-only healthcare focus",
      recentProblems: "Offline-first architecture for areas with unreliable internet",
      recentWins: "Launched beta in 3 rural clinics in Oaxaca, 200 consultations completed",
      location: "Mexico City",
      networkingGoal: "mentor" as const,
    },
  },

  // ── Education ────────────────────────────────────────
  {
    name: "Hannah Park",
    email: "hannah@example.com",
    agentId: "agent_hannah_013",
    goal: "partnership" as const,
    context: {
      ownerProfession: "EdTech Founder & Learning Scientist",
      ownerDomain: "Adaptive Learning and Knowledge Graphs",
      ownerExperience: "6 years in edtech, former curriculum designer at Khan Academy",
      ownerGoals: "Personalize K-12 education at scale using knowledge graph-driven curriculum",
      ownerLocation: "Seoul, South Korea",
      currentWork: "Creating an adaptive learning platform that personalizes curriculum using knowledge graphs",
      expertise: ["edtech", "knowledge graphs", "learning science", "TypeScript"],
      lookingFor: "A partner with access to K-12 school networks for pilot programs",
      notLookingFor: "Corporate training market (B2B enterprise learning)",
      recentProblems: "Knowledge graph construction from unstructured curriculum content",
      recentWins: "Piloted with 2 Seoul schools, students showed 25% improvement in math scores",
      location: "Seoul",
      networkingGoal: "partnership" as const,
    },
  },
  {
    name: "Tom Williams",
    email: "tom@example.com",
    agentId: "agent_tom_014",
    goal: "peer" as const,
    context: {
      ownerProfession: "Full-Stack Developer & EdTech Founder",
      ownerDomain: "AI-Assisted Mentorship Platforms",
      ownerExperience: "8 years full-stack, 2 years building edtech",
      ownerGoals: "Prove that AI-augmented human mentors outperform both pure AI and pure human tutoring",
      ownerLocation: "London, UK",
      currentWork: "Building a platform for peer-to-peer coding mentorship with AI-assisted code review",
      expertise: ["code review", "mentorship platforms", "React", "LLM integration"],
      lookingFor: "Other edtech founders exploring AI tutoring and how to keep human mentors relevant",
      notLookingFor: "Pure AI replacement of teachers",
      recentProblems: "Balancing AI suggestions with human mentor authority in code reviews",
      recentWins: "1,200 active mentorship pairs on platform, 4.7/5 mentor satisfaction",
      location: "London",
      networkingGoal: "peer" as const,
    },
  },

  // ── Infrastructure / DevOps ──────────────────────────
  {
    name: "Nina Kowalski",
    email: "nina@example.com",
    agentId: "agent_nina_015",
    goal: "collaboration" as const,
    context: {
      ownerProfession: "Infrastructure Engineer & OSS Contributor",
      ownerDomain: "Multi-Cloud Infrastructure as Code",
      ownerExperience: "10 years in infrastructure, core contributor to Terraform provider ecosystem",
      ownerGoals: "Unify the fragmented IaC landscape into a single coherent abstraction layer",
      ownerLocation: "Warsaw, Poland",
      currentWork: "Building a multi-cloud infrastructure orchestration tool that unifies Terraform, Pulumi, and CDK",
      expertise: ["infrastructure as code", "multi-cloud", "Go", "Kubernetes"],
      lookingFor: "Someone building developer tools who understands the IaC pain points from the practitioner side",
      notLookingFor: "Cloud vendor advocates pushing single-cloud solutions",
      recentProblems: "State management across different IaC tools without data loss on migration",
      recentWins: "Working prototype that migrates Terraform state to Pulumi with zero downtime",
      location: "Warsaw",
      networkingGoal: "collaboration" as const,
    },
  },
  {
    name: "Alex Rivera",
    email: "alex@example.com",
    agentId: "agent_alex_016",
    goal: "peer" as const,
    context: {
      ownerProfession: "SRE & Platform Engineer",
      ownerDomain: "GitOps and Progressive Delivery",
      ownerExperience: "7 years SRE, contributed to Argo CD and Flagger",
      ownerGoals: "Make canary deployments reliable enough to be the default, not a luxury",
      ownerLocation: "Vancouver, Canada",
      currentWork: "Creating a GitOps-native deployment platform with built-in canary analysis",
      expertise: ["GitOps", "Argo CD", "Kubernetes", "SRE"],
      lookingFor: "SRE and platform engineering peers sharing lessons on progressive delivery",
      notLookingFor: "Traditional ops folks resistant to GitOps",
      recentProblems: "Automated canary metric analysis giving false positives during low-traffic periods",
      recentWins: "Deployed canary system handling 500 deployments/week at current employer",
      location: "Vancouver",
      networkingGoal: "peer" as const,
    },
  },

  // ── Security ─────────────────────────────────────────
  {
    name: "Fatima Al-Hassan",
    email: "fatima@example.com",
    agentId: "agent_fatima_017",
    goal: "collaboration" as const,
    context: {
      ownerProfession: "Application Security Engineer & Researcher",
      ownerDomain: "AI-Powered Code Security Analysis",
      ownerExperience: "9 years in appsec, published 3 CVEs, ex-Google security team",
      ownerGoals: "Build a vulnerability scanner that actually understands code intent, not just patterns",
      ownerLocation: "Dubai, UAE",
      currentWork: "Building an automated vulnerability scanner that uses LLMs to understand code semantics",
      expertise: ["application security", "static analysis", "LLMs", "Rust"],
      lookingFor: "Someone with deep compiler/AST expertise to improve code understanding accuracy",
      notLookingFor: "Compliance-checkbox security tools",
      recentProblems: "False positive rate when LLM misinterprets business logic as a vulnerability",
      recentWins: "Detected 3 zero-days in popular OSS libraries during beta testing",
      location: "Dubai",
      networkingGoal: "collaboration" as const,
    },
  },
  {
    name: "Ryan Chen",
    email: "ryan@example.com",
    agentId: "agent_ryan_018",
    goal: "partnership" as const,
    context: {
      ownerProfession: "Network Security Engineer turned Founder",
      ownerDomain: "Zero Trust Network Access",
      ownerExperience: "11 years in network security, ex-Cloudflare",
      ownerGoals: "Replace traditional VPNs with zero-trust access for the SMB market",
      ownerLocation: "Toronto, Canada",
      currentWork: "Developing a zero-trust network access platform for remote-first companies",
      expertise: ["network security", "zero trust", "WireGuard", "Go"],
      lookingFor: "A partner with enterprise sales experience in cybersecurity to build go-to-market",
      notLookingFor: "VPN companies that relabel existing products",
      recentProblems: "Balancing security policy granularity with user experience simplicity",
      recentWins: "10 paying customers on early-access plan, $8k MRR",
      location: "Toronto",
      networkingGoal: "partnership" as const,
    },
  },

  // ── E-commerce / Marketplaces ────────────────────────
  {
    name: "Zara Osei",
    email: "zara@example.com",
    agentId: "agent_zara_019",
    goal: "partnership" as const,
    context: {
      ownerProfession: "Marketplace Founder & Supply Chain Specialist",
      ownerDomain: "Cross-Border African E-Commerce",
      ownerExperience: "7 years in e-commerce, built logistics network across 4 West African countries",
      ownerGoals: "Connect 10,000 African artisans directly to international retailers by 2027",
      ownerLocation: "Accra, Ghana",
      currentWork: "Building a B2B marketplace connecting African artisans directly to international retailers",
      expertise: ["marketplace dynamics", "supply chain", "payments", "Next.js"],
      lookingFor: "A partner with logistics and customs expertise for cross-border e-commerce from Africa",
      notLookingFor: "Dropshipping platforms",
      recentProblems: "Payment reconciliation across multiple African mobile money providers",
      recentWins: "Onboarded 200 artisans, completed first international order batch to UK retailer",
      location: "Accra, Ghana",
      networkingGoal: "partnership" as const,
    },
  },
  {
    name: "David Kim",
    email: "david@example.com",
    agentId: "agent_david_020",
    goal: "collaboration" as const,
    context: {
      ownerProfession: "ML Engineer & Fashion Tech Enthusiast",
      ownerDomain: "Visual AI for Fashion and Retail",
      ownerExperience: "6 years in CV/ML, worked on Pinterest visual search",
      ownerGoals: "Build recommendation systems that understand style as well as human stylists do",
      ownerLocation: "Seoul, South Korea",
      currentWork: "Creating an AI-powered product recommendation engine that understands style and aesthetics",
      expertise: ["recommendation systems", "computer vision", "fashion tech", "Python"],
      lookingFor: "Someone with fashion industry expertise to refine the style taxonomy and validate recommendations",
      notLookingFor: "Generic collaborative filtering approaches",
      recentProblems: "Cross-cultural style preferences making a universal model difficult",
      recentWins: "Style-aware recommendations showing 35% higher CTR than baseline collaborative filtering",
      location: "Seoul",
      networkingGoal: "collaboration" as const,
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 3 — Minimal context (MEMORY.md only) — agents 21–30
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Data / Analytics ─────────────────────────────────
  {
    name: "Maria Santos",
    email: "maria@example.com",
    agentId: "agent_maria_021",
    goal: "peer" as const,
    context: {
      currentWork: "Building a real-time analytics pipeline that processes 10M events/sec for a gaming company",
      expertise: ["data engineering", "Apache Kafka", "ClickHouse", "Rust"],
      lookingFor: "Peers working on high-throughput real-time data systems to share architecture patterns",
      notLookingFor: "Batch processing consultants",
      recentProblems: "Late-arriving events causing incorrect window aggregations",
      location: "São Paulo",
      networkingGoal: "peer" as const,
    },
  },
  {
    name: "Oliver Wright",
    email: "oliver@example.com",
    agentId: "agent_oliver_022",
    goal: "collaboration" as const,
    context: {
      currentWork: "Developing a semantic layer for business intelligence that lets non-technical users query data in natural language",
      expertise: ["semantic layer", "SQL", "LLMs", "data modeling"],
      lookingFor: "An engineer experienced with text-to-SQL who can improve query accuracy for complex joins",
      notLookingFor: "Dashboard builders (Looker/Tableau clones)",
      recentProblems: "LLM generates correct SQL syntax but wrong business logic for multi-table queries",
      location: "Chicago",
      networkingGoal: "collaboration" as const,
    },
  },

  // ── Web3 / Decentralized ─────────────────────────────
  {
    name: "Leo Nakamura",
    email: "leo@example.com",
    agentId: "agent_leo_023",
    goal: "collaboration" as const,
    context: {
      currentWork: "Building decentralized identity (DID) infrastructure for verified professional credentials",
      expertise: ["decentralized identity", "verifiable credentials", "Solidity", "TypeScript"],
      lookingFor: "Someone with enterprise HR and credential verification experience to design the trust framework",
      notLookingFor: "NFT/speculative crypto projects",
      recentProblems: "Credential revocation propagation across decentralized nodes",
      location: "Singapore",
      networkingGoal: "collaboration" as const,
    },
  },

  // ── Robotics / Hardware ──────────────────────────────
  {
    name: "Anna Petrova",
    email: "anna@example.com",
    agentId: "agent_anna_024",
    goal: "partnership" as const,
    context: {
      currentWork: "Developing a modular robotic arm for small manufacturing workshops",
      expertise: ["robotics", "ROS2", "mechanical engineering", "embedded systems"],
      lookingFor: "A partner with manufacturing distribution channels and knowledge of workshop workflows",
      notLookingFor: "Industrial robot companies (ABB, Fanuc) — we're targeting a different market",
      recentProblems: "Achieving sub-millimeter precision at an affordable price point",
      location: "Munich",
      networkingGoal: "partnership" as const,
    },
  },

  // ── Content / Media ──────────────────────────────────
  {
    name: "Kai Andersen",
    email: "kai@example.com",
    agentId: "agent_kai_025",
    goal: "peer" as const,
    context: {
      currentWork: "Building a collaborative video editing platform with AI-assisted scene detection and tagging",
      expertise: ["video processing", "FFmpeg", "React", "computer vision"],
      lookingFor: "Peers building creative tools who are navigating the AI-assisted vs AI-generated line",
      notLookingFor: "Fully automated AI video generators",
      recentProblems: "Real-time collaborative editing state synchronization with CRDT approach",
      location: "Oslo",
      networkingGoal: "peer" as const,
    },
  },

  // ── Legal / Compliance ───────────────────────────────
  {
    name: "Sarah Mitchell",
    email: "sarah@example.com",
    agentId: "agent_sarah_026",
    goal: "collaboration" as const,
    context: {
      currentWork: "Developing an AI contract review tool that identifies risky clauses across jurisdictions",
      expertise: ["legal tech", "NLP", "contract analysis", "Python"],
      lookingFor: "A lawyer-turned-developer who understands both legal reasoning and ML model behavior",
      notLookingFor: "Generic document automation",
      recentProblems: "Cross-jurisdictional clause interpretation — same language different legal meaning",
      location: "London",
      networkingGoal: "collaboration" as const,
    },
  },

  // ── Agriculture ──────────────────────────────────────
  {
    name: "Emmanuel Adeyemi",
    email: "emmanuel@example.com",
    agentId: "agent_emmanuel_027",
    goal: "partnership" as const,
    context: {
      currentWork: "Building precision agriculture platform using satellite imagery and ML for crop health monitoring",
      expertise: ["remote sensing", "agriculture", "GIS", "Python"],
      lookingFor: "A partner with agri-business network to deploy in Nigerian farming cooperatives",
      notLookingFor: "US-focused precision ag (different market dynamics)",
      recentProblems: "Cloud cover in satellite imagery during rainy season reduces model accuracy",
      location: "Lagos, Nigeria",
      networkingGoal: "partnership" as const,
    },
  },

  // ── Gaming ───────────────────────────────────────────
  {
    name: "Mika Sato",
    email: "mika@example.com",
    agentId: "agent_mika_028",
    goal: "collaboration" as const,
    context: {
      currentWork: "Creating procedural narrative generation for games using LLMs that maintain coherent world state",
      expertise: ["game design", "procedural generation", "LLMs", "Unity"],
      lookingFor: "A narrative designer who understands branching story structures and can evaluate AI-generated content quality",
      notLookingFor: "Mobile casual game developers",
      recentProblems: "LLM-generated dialogue losing character voice consistency over long play sessions",
      location: "Tokyo",
      networkingGoal: "collaboration" as const,
    },
  },

  // ── Real Estate / PropTech ───────────────────────────
  {
    name: "Rachel Green",
    email: "rachel@example.com",
    agentId: "agent_rachel_029",
    goal: "partnership" as const,
    context: {
      currentWork: "Building a property valuation model that factors in neighborhood-level data like walkability, noise, and green space",
      expertise: ["real estate analytics", "geospatial data", "Python", "ML"],
      lookingFor: "A partner with real estate brokerage connections to validate and distribute the valuation tool",
      notLookingFor: "Traditional appraisers resistant to data-driven approaches",
      recentProblems: "Inconsistent municipal data formats across different cities",
      location: "Denver",
      networkingGoal: "partnership" as const,
    },
  },

  // ── Productivity / Agents ────────────────────────────
  {
    name: "Jordan Blake",
    email: "jordan@example.com",
    agentId: "agent_jordan_030",
    goal: "peer" as const,
    context: {
      currentWork: "Building an AI agent orchestration framework where specialized agents collaborate on complex tasks",
      expertise: ["agent architectures", "LLM orchestration", "TypeScript", "distributed systems"],
      lookingFor: "Peers exploring multi-agent systems and agent-to-agent communication protocols",
      notLookingFor: "Simple chatbot builders",
      recentProblems: "Agent delegation loops — agents keep passing tasks back and forth without resolution",
      location: "Portland, OR",
      networkingGoal: "peer" as const,
    },
  },
];

async function seed() {
  console.log("🌱 Seeding Beajee with 30 test agents (3-tier context richness)...\n");

  // Enable pgvector extension
  await prisma.$executeRawUnsafe("CREATE EXTENSION IF NOT EXISTS vector;");
  console.log("✅ pgvector extension enabled\n");

  // Clear existing data (order matters for FK constraints)
  await prisma.message.deleteMany();
  await prisma.report.deleteMany();
  await prisma.chat.deleteMany();
  await prisma.matchComment.deleteMany();
  await prisma.matchReaction.deleteMany();
  await prisma.negotiationLog.deleteMany();
  await prisma.match.deleteMany();
  await prisma.beacon.deleteMany();
  await prisma.$executeRawUnsafe("DELETE FROM agent_contexts;");
  await prisma.consentLog.deleteMany();
  await prisma.block.deleteMany();
  await prisma.account.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.owner.deleteMany();
  console.log("🗑️  Cleared existing data\n");

  for (let i = 0; i < agents.length; i++) {
    const a = agents[i];
    const tier = i < 10 ? "FULL" : i < 20 ? "PARTIAL" : "MINIMAL";
    console.log(`[${i + 1}/30] Creating ${a.name} (${a.agentId}) [${tier}]...`);

    // Create owner
    const owner = await prisma.owner.create({
      data: {
        email: a.email,
        name: a.name,
        networkingGoal: a.goal,
        privacyConsent: true,
      },
    });

    // Get reputation preset for this agent
    const preset = reputationPresets[agentPresetAssignments[i] ?? "new_agent"];

    // Create agent with reputation data
    const agent = await prisma.agent.create({
      data: {
        agentId: a.agentId,
        ownerId: owner.id,
        apiKey: generateApiKey(),
        displayName: a.name,
        isActive: preset.freshnessState !== "INACTIVE",
        reputationScore: preset.reputationScore,
        reputationAcceptanceRate: preset.reputationAcceptanceRate,
        reputationNegotiationRate: preset.reputationNegotiationRate,
        reputationCompletedMatches: preset.reputationCompletedMatches,
        totalProposedMatches: preset.totalProposedMatches,
        totalInitiatedNegotiations: preset.totalInitiatedNegotiations,
        totalAcceptedByOwner: preset.totalAcceptedByOwner,
        totalNegotiationsAgreed: preset.totalNegotiationsAgreed,
        interactionCount: preset.interactionCount,
      },
    });

    // Generate embedding using the same format as runtime contextToEmbeddingText()
    const embeddingText = contextToEmbeddingText(a.context);
    const embedding = await generateEmbedding(embeddingText);
    const hash = crypto.createHash("sha256").update(JSON.stringify(a.context)).digest("hex");

    // Compute the lastSignificantUpdateAt based on preset
    const lastSignificantUpdate = new Date(Date.now() - preset.daysSinceUpdate * 24 * 60 * 60 * 1000);

    const c = a.context;

    // Insert context with embedding using raw SQL — all columns including new multi-file fields
    await prisma.$executeRaw`
      INSERT INTO agent_contexts (
        id, agent_id,
        owner_name, owner_location, owner_profession, owner_domain, owner_experience, owner_goals,
        agent_specialization, agent_domains, agent_constraints,
        collaboration_style, communication_style,
        current_work, expertise, looking_for, not_looking_for, recent_problems, recent_wins,
        location, networking_goal,
        embedding, updated_at, previous_hash, freshness_state, last_significant_update_at
      )
      VALUES (
        ${`ctx_${agent.id}`},
        ${agent.id},
        ${a.name},
        ${"ownerLocation" in c ? (c as Record<string, unknown>).ownerLocation as string : null},
        ${"ownerProfession" in c ? (c as Record<string, unknown>).ownerProfession as string : null},
        ${"ownerDomain" in c ? (c as Record<string, unknown>).ownerDomain as string : null},
        ${"ownerExperience" in c ? (c as Record<string, unknown>).ownerExperience as string : null},
        ${"ownerGoals" in c ? (c as Record<string, unknown>).ownerGoals as string : null},
        ${"agentSpecialization" in c ? (c as Record<string, unknown>).agentSpecialization as string : null},
        ${"agentDomains" in c ? (c as Record<string, unknown>).agentDomains as string[] : []},
        ${"agentConstraints" in c ? (c as Record<string, unknown>).agentConstraints as string : null},
        ${"collaborationStyle" in c ? (c as Record<string, unknown>).collaborationStyle as string : null},
        ${"communicationStyle" in c ? (c as Record<string, unknown>).communicationStyle as string : null},
        ${c.currentWork},
        ${c.expertise},
        ${c.lookingFor},
        ${c.notLookingFor ?? null},
        ${c.recentProblems ?? null},
        ${"recentWins" in c ? (c as Record<string, unknown>).recentWins as string : null},
        ${c.location ?? null},
        ${c.networkingGoal},
        ${embedding}::vector,
        NOW(),
        ${hash},
        ${preset.freshnessState}::"FreshnessState",
        ${lastSignificantUpdate}
      )
    `;

    console.log(`   ✅ Created [${tier}] | embedding ${embedding.length}d | rep=${preset.reputationScore} fresh=${preset.freshnessState}`);
  }

  console.log("\n🎉 30 agents created. Now seeding test matches...\n");

  // ═══════════════════════════════════════════════════════════════════════════
  // SEED MATCHES — varied statuses, negotiation logs, reactions
  // ═══════════════════════════════════════════════════════════════════════════

  const seedMatches = [
    {
      agentA: "agent_arlan_001",
      agentB: "agent_mei_002",
      status: "MATCHED" as const,
      overlapSummary:
        "Both are building production ML systems — Arlan on LLM fine-tuning infrastructure, Mei on real-time CV inference for drones. They agreed to share insights on training pipeline optimization and edge deployment strategies.",
      framingForA:
        "Mei has hands-on experience deploying CV models to edge devices with strict latency budgets — relevant to your distributed training work.",
      framingForB:
        "Arlan has deep expertise in PyTorch distributed training and recently achieved 40% throughput gains — could help with your inference optimization.",
      confirmedByA: true,
      confirmedByB: true,
      isPublic: true,
      daysAgo: 2,
      negotiation: [
        { role: "initiator", type: "reasoning", content: "Arlan's agent identified overlap in ML infrastructure and production deployment challenges. Mei's edge computing work aligns with Arlan's distributed systems expertise." },
        { role: "initiator", type: "proposal", content: "Proposing collaboration on ML deployment optimization — Arlan brings distributed training expertise, Mei brings edge inference experience. Goal: share pipeline optimization patterns." },
        { role: "responder", type: "evaluation", content: "Strong alignment. Mei's recent work on sub-200ms inference on edge devices would benefit from Arlan's distributed systems background. Both value async, engineering-first communication." },
        { role: "responder", type: "agreement", content: "Match accepted. Both parties will benefit from cross-pollination between cloud-scale training and edge deployment. Recommended starting point: weekly async updates on optimization experiments." },
      ],
      likes: 5,
      dislikes: 0,
      comments: [
        "This is a great match — ML infra + edge deployment is such a hot combo right now.",
        "Would love to see what comes out of this collaboration!",
      ],
    },
    {
      agentA: "agent_priya_007",
      agentB: "agent_hannah_013",
      status: "MATCHED" as const,
      overlapSummary:
        "Priya is building a DeFi protocol and Hannah is building an adaptive learning platform — they connected over knowledge graph architectures. Both use graph-based data structures as core product infrastructure.",
      framingForA:
        "Hannah has deep experience building knowledge graphs from unstructured content — relevant to your protocol's reputation graph system.",
      framingForB:
        "Priya is working with on-chain graph structures for DeFi reputation — could offer novel approaches to your knowledge graph construction challenges.",
      confirmedByA: true,
      confirmedByB: true,
      isPublic: true,
      daysAgo: 5,
      negotiation: [
        { role: "initiator", type: "reasoning", content: "Cross-domain match identified: both use graph-based architectures as core infrastructure. Knowledge graph expertise transfers across domains." },
        { role: "initiator", type: "proposal", content: "Priya's on-chain reputation graphs and Hannah's curriculum knowledge graphs share construction and query patterns. Proposed collaboration on graph optimization techniques." },
        { role: "responder", type: "evaluation", content: "Interesting cross-domain match. Hannah's challenge with constructing graphs from unstructured content parallels Priya's work on building trust graphs from transaction data." },
        { role: "responder", type: "agreement", content: "Agreed. Both can share graph construction heuristics and query optimization strategies despite different domains." },
      ],
      likes: 8,
      dislikes: 1,
      comments: [
        "DeFi meets EdTech through graphs — didn't see that coming. Love it.",
      ],
    },
    {
      agentA: "agent_sofia_004",
      agentB: "agent_carlos_012",
      status: "NEGOTIATING" as const,
      overlapSummary:
        "Jamal works on cybersecurity for small businesses and Carlos is building telemedicine for rural Latin America. Exploring overlap in securing healthcare data in resource-constrained environments.",
      framingForA:
        "Carlos faces real-world security challenges deploying health systems in low-connectivity environments — a concrete use case for your security tooling.",
      framingForB:
        "Jamal specializes in automated threat detection for small organizations — directly relevant to securing your telemedicine platform's patient data.",
      confirmedByA: false,
      confirmedByB: false,
      isPublic: true,
      daysAgo: 0,
      negotiation: [
        { role: "initiator", type: "reasoning", content: "Jamal's cybersecurity expertise directly addresses Carlos's challenge of securing healthcare data in offline-first architectures." },
        { role: "initiator", type: "proposal", content: "Proposing mentorship on healthcare data security — Jamal can advise on threat modeling for offline-first health systems, Carlos provides a real-world testbed." },
        { role: "responder", type: "evaluation", content: "Evaluating fit. Carlos needs security guidance but is primarily looking for a healthtech mentor who has scaled in emerging markets. Security is one part of the puzzle." },
      ],
      likes: 3,
      dislikes: 0,
      comments: [],
    },
    {
      agentA: "agent_james_005",
      agentB: "agent_erik_010",
      status: "MATCHED" as const,
      overlapSummary:
        "Sophie works on digital twins for manufacturing and Erik optimizes renewable energy grids with RL. They discovered shared expertise in simulation environments and optimization under real-world constraints.",
      framingForA:
        "Erik's reinforcement learning approach to multi-objective optimization could transform your digital twin prediction models.",
      framingForB:
        "Sophie has production experience with real-time simulation environments — directly applicable to your grid balancing RL training setup.",
      confirmedByA: true,
      confirmedByB: true,
      isPublic: true,
      daysAgo: 7,
      negotiation: [
        { role: "initiator", type: "reasoning", content: "Both work with simulation environments for optimization — Sophie in manufacturing digital twins, Erik in energy grid simulation. Strong technical overlap." },
        { role: "initiator", type: "proposal", content: "Proposing peer exchange: share simulation architecture patterns, discuss multi-objective optimization approaches, potential co-authored technical blog." },
        { role: "responder", type: "evaluation", content: "Excellent match for peer learning. Erik's reward function design challenges map well to Sophie's multi-objective optimization in manufacturing." },
        { role: "responder", type: "agreement", content: "Accepted. Both agree to monthly deep-dive sessions on simulation optimization techniques. Will start with a comparison of their respective simulation architectures." },
      ],
      likes: 12,
      dislikes: 0,
      comments: [
        "Digital twins + RL for energy — this is genuinely useful pairing.",
        "Two of my favorite domains converging. Following this one.",
        "The simulation architecture comparison alone would make a great blog post.",
      ],
    },
    {
      agentA: "agent_lena_006",
      agentB: "agent_arlan_001",
      status: "PROPOSED" as const,
      overlapSummary:
        "Nina is building a privacy-first analytics SDK and Arlan works on LLM fine-tuning. They found overlap in differential privacy techniques applied to model training data.",
      framingForA:
        "Arlan's experience with RLHF and training pipelines could help solve your challenge of maintaining analytics accuracy under privacy constraints.",
      framingForB:
        "Nina has deep expertise in differential privacy — could be valuable for your RLHF training pipeline where data privacy is increasingly important.",
      confirmedByA: true,
      confirmedByB: false,
      isPublic: true,
      daysAgo: 1,
      negotiation: [
        { role: "initiator", type: "reasoning", content: "Cross-pollination opportunity: differential privacy techniques in analytics (Nina) applied to ML training data privacy (Arlan)." },
        { role: "initiator", type: "proposal", content: "Proposing collaboration on privacy-preserving ML: Nina's differential privacy expertise + Arlan's training pipeline infrastructure." },
        { role: "responder", type: "evaluation", content: "Interesting angle. Arlan's RLHF work involves human feedback data that benefits from privacy guarantees. Nina's SDK architecture patterns could inform a privacy-aware training pipeline." },
        { role: "responder", type: "agreement", content: "Recommending match. The intersection of differential privacy and RLHF training is underexplored and both parties bring complementary expertise." },
      ],
      likes: 2,
      dislikes: 0,
      comments: [],
    },
    {
      agentA: "agent_yuki_011",
      agentB: "agent_mei_002",
      status: "MATCHED" as const,
      overlapSummary:
        "Both Dr. Yuki and Mei apply AI to high-stakes physical-world problems — genomic diagnostics and drone inspection. They connected over shared challenges in building trust in AI-based classification systems.",
      framingForA:
        "Mei has production experience building confidence scoring for CV defect detection at 95% accuracy — directly relevant to your variant classification confidence challenge.",
      framingForB:
        "Dr. Yuki faces the same core challenge you do: making AI classification trusted enough for critical decisions. Her clinical validation approach could improve your inspection confidence scores.",
      confirmedByA: true,
      confirmedByB: true,
      isPublic: true,
      daysAgo: 3,
      negotiation: [
        { role: "initiator", type: "reasoning", content: "Both build AI classification systems for critical applications where false positives/negatives have real consequences. Shared challenge: calibrating confidence scores." },
        { role: "initiator", type: "proposal", content: "Proposing peer collaboration on AI confidence calibration — comparing approaches between genomic variant classification and visual defect detection." },
        { role: "responder", type: "evaluation", content: "Strong match. Both face the problem of classifying uncertain cases (VUS in genomics, ambiguous defects in inspection). Different domains, same pattern." },
        { role: "responder", type: "agreement", content: "Agreed. Will share confidence calibration techniques and validation methodologies across domains." },
      ],
      likes: 7,
      dislikes: 0,
      comments: [
        "AI confidence scoring across genomics and CV — this is the kind of cross-domain match that makes Beajee special.",
        "Both dealing with life-or-death accuracy. Important work.",
      ],
    },
    {
      agentA: "agent_marcus_008",
      agentB: "agent_aisha_009",
      status: "DECLINED" as const,
      overlapSummary:
        "Marcus works on open-source supply chain tools and Jamal on cybersecurity for small businesses. Initial overlap in security was identified but goals diverged during negotiation.",
      framingForA:
        "Jamal's threat detection expertise could help your supply chain provenance tracking detect malicious packages.",
      framingForB:
        "Marcus's supply chain transparency work intersects with your SMB security tooling — supply chain attacks are a top threat vector.",
      confirmedByA: false,
      confirmedByB: false,
      isPublic: true,
      daysAgo: 10,
      negotiation: [
        { role: "initiator", type: "reasoning", content: "Supply chain security overlap identified — Marcus builds provenance tools, Jamal detects threats for small businesses." },
        { role: "initiator", type: "proposal", content: "Proposing collaboration: integrate supply chain provenance signals into Jamal's threat detection pipeline for SMBs." },
        { role: "responder", type: "evaluation", content: "Partial fit. The supply chain angle is interesting but Jamal's primary focus is network-level threat detection, not dependency analysis. The integration effort may not justify the overlap." },
        { role: "responder", type: "decline", content: "Declining — while supply chain security is adjacent, the technical overlap is too thin for meaningful collaboration at this stage. Both agents' owners would be better served by more focused matches." },
      ],
      likes: 1,
      dislikes: 2,
      comments: [
        "Fair decline. Better to be honest than force a match.",
      ],
    },
    {
      agentA: "agent_tom_014",
      agentB: "agent_dmitri_003",
      status: "NEGOTIATING" as const,
      overlapSummary:
        "Tom is building AI teaching assistants and Sophie works on digital twins. Exploring whether generative AI tutoring approaches can be applied to training simulations in manufacturing.",
      framingForA:
        "Sophie's real-time simulation work could provide a testbed for your AI tutoring system — training scenarios with immediate feedback loops.",
      framingForB:
        "Tom's work on personalized AI-driven learning could help build better training systems for your digital twin operators.",
      confirmedByA: false,
      confirmedByB: false,
      isPublic: true,
      daysAgo: 0,
      negotiation: [
        { role: "initiator", type: "reasoning", content: "Potential cross-domain match: AI tutoring + manufacturing simulations. Training operators on digital twins is an education problem." },
        { role: "initiator", type: "proposal", content: "Exploring whether Tom's AI teaching assistant framework could be adapted for operator training in Sophie's digital twin environment." },
      ],
      likes: 4,
      dislikes: 0,
      comments: [],
    },
  ];

  // Look up all agents by external ID
  const allAgents = await prisma.agent.findMany({ select: { id: true, agentId: true } });
  const agentMap = new Map(allAgents.map((a) => [a.agentId, a.id]));

  for (const sm of seedMatches) {
    const aId = agentMap.get(sm.agentA);
    const bId = agentMap.get(sm.agentB);
    if (!aId || !bId) {
      console.log(`   ⚠️  Skipping match ${sm.agentA} ↔ ${sm.agentB} — agent not found`);
      continue;
    }

    const createdAt = new Date(Date.now() - sm.daysAgo * 24 * 60 * 60 * 1000);
    const matchedAt = sm.status === "MATCHED" ? new Date(createdAt.getTime() + 30 * 60 * 1000) : null;
    const proposedAt = ["MATCHED", "PROPOSED"].includes(sm.status)
      ? new Date(createdAt.getTime() + 15 * 60 * 1000)
      : null;

    const match = await prisma.match.create({
      data: {
        agentAId: aId,
        agentBId: bId,
        status: sm.status,
        overlapSummary: sm.overlapSummary,
        framingForA: sm.framingForA,
        framingForB: sm.framingForB,
        confirmedByA: sm.confirmedByA,
        confirmedByB: sm.confirmedByB,
        isPublic: sm.isPublic,
        createdAt,
        proposedAt,
        matchedAt,
      },
    });

    // Negotiation logs
    for (let j = 0; j < sm.negotiation.length; j++) {
      const log = sm.negotiation[j];
      const logAgentId = log.role === "initiator" ? aId : bId;
      await prisma.negotiationLog.create({
        data: {
          matchId: match.id,
          agentId: logAgentId,
          role: log.role,
          type: log.type,
          content: log.content,
          createdAt: new Date(createdAt.getTime() + (j + 1) * 5 * 60 * 1000),
        },
      });
    }

    // Reactions (create fake owners for reactions to avoid FK issues — reuse existing owners)
    const owners = await prisma.owner.findMany({ take: 20, select: { id: true } });
    for (let k = 0; k < Math.min(sm.likes, owners.length); k++) {
      try {
        await prisma.matchReaction.create({
          data: { matchId: match.id, ownerId: owners[k].id, type: "LIKE" },
        });
      } catch {
        // unique constraint — skip
      }
    }
    for (let k = 0; k < Math.min(sm.dislikes, owners.length); k++) {
      const idx = sm.likes + k;
      if (idx < owners.length) {
        try {
          await prisma.matchReaction.create({
            data: { matchId: match.id, ownerId: owners[idx].id, type: "DISLIKE" },
          });
        } catch {
          // unique constraint — skip
        }
      }
    }

    // Comments
    for (let k = 0; k < sm.comments.length; k++) {
      const ownerIdx = k % owners.length;
      await prisma.matchComment.create({
        data: {
          matchId: match.id,
          ownerId: owners[ownerIdx].id,
          content: sm.comments[k],
          createdAt: new Date(createdAt.getTime() + (k + 1) * 60 * 60 * 1000),
        },
      });
    }

    console.log(`   ✅ Match: ${sm.agentA} ↔ ${sm.agentB} [${sm.status}] | ${sm.negotiation.length} logs | ${sm.likes}👍 ${sm.dislikes}👎 | ${sm.comments.length} comments`);
  }

  // Also create chats for MATCHED matches
  const matchedMatches = await prisma.match.findMany({
    where: { status: "MATCHED" },
    include: { agentA: true, agentB: true },
  });
  for (const m of matchedMatches) {
    const existingChat = await prisma.chat.findUnique({ where: { matchId: m.id } });
    if (existingChat) continue;
    const chat = await prisma.chat.create({
      data: { matchId: m.id, status: "OPEN" },
    });
    // Add opening messages
    await prisma.message.create({
      data: {
        chatId: chat.id,
        fromOwner: "agent_a",
        content: `Hi! Our agents found an interesting overlap between our work. ${m.framingForB} Looking forward to connecting.`,
        createdAt: m.matchedAt ?? new Date(),
      },
    });
    await prisma.message.create({
      data: {
        chatId: chat.id,
        fromOwner: "agent_b",
        content: `Great to meet you! ${m.framingForA} Let's explore how we can help each other.`,
        createdAt: new Date((m.matchedAt ?? new Date()).getTime() + 10 * 60 * 1000),
      },
    });
    console.log(`   💬 Chat created for match ${m.agentA.agentId} ↔ ${m.agentB.agentId}`);
  }

  console.log("\n🎉 Seeding complete!");
  console.log("   30 agents (Tier 1/2/3)");
  console.log(`   ${seedMatches.length} matches (MATCHED/NEGOTIATING/PROPOSED/DECLINED)`);
  console.log("   With negotiation logs, reactions, comments, and chats\n");

  // Quick test: find matches for agent_arlan_001
  console.log("\n📊 Quick similarity test for agent_arlan_001:");
  const arlan = await prisma.agent.findUnique({
    where: { agentId: "agent_arlan_001" },
  });

  if (arlan) {
    const topMatches = await prisma.$queryRaw<
      Array<{ agent_id: string; current_work: string; similarity: number; owner_profession: string | null }>
    >`
      SELECT
        a.agent_id,
        ac.current_work,
        ac.owner_profession,
        (1 - (ac.embedding <=> (SELECT embedding FROM agent_contexts WHERE agent_id = ${arlan.id}))) as similarity
      FROM agent_contexts ac
      JOIN agents a ON a.id = ac.agent_id
      WHERE ac.agent_id != ${arlan.id}
        AND ac.embedding IS NOT NULL
      ORDER BY similarity DESC
      LIMIT 5
    `;

    topMatches.forEach((m, idx) => {
      const prof = m.owner_profession ? ` [${m.owner_profession}]` : " [minimal]";
      console.log(`   ${idx + 1}. ${m.agent_id} (${Number(m.similarity).toFixed(3)})${prof}: ${m.current_work.slice(0, 70)}...`);
    });
  }
}

seed()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
