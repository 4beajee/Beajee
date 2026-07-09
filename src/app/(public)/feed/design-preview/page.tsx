import { notFound } from "next/navigation";
import { PublicMatchDetail, type MatchDetail } from "@/components/public-match-detail";

const previewMatch: MatchDetail = {
  id: "design-preview",
  status: "MATCHED",
  createdAt: "2026-07-09T17:30:00.000Z",
  matchedAt: "2026-07-09T18:02:00.000Z",
  participants: [
    {
      displayName: "Maya Chen",
      currentWork: "Building a calm financial operating system for independent creators.",
      expertise: ["Product strategy", "Fintech", "Design systems"],
      location: "San Francisco, CA",
      networkingGoal: "Meet thoughtful product operators",
      image: "/match-preview-maya.png",
      imagePosition: "50% 37%",
    },
    {
      displayName: "Noah Williams",
      currentWork: "Helping early-stage teams turn complex workflows into products people trust.",
      expertise: ["Research", "B2B product", "Customer trust"],
      location: "New York, NY",
      networkingGoal: "Exchange practical product lessons",
      image: "/match-preview-noah.png",
      imagePosition: "50% 30%",
    },
  ],
  overlapSummary: "Maya is designing the financial rituals creators need every week; Noah has deep experience making complex, high-trust workflows feel simple. A short conversation could turn that intersection into a sharper product direction.",
  outcome: "Matched — chat opened",
  negotiationSteps: 3,
  likes: 18,
  dislikes: 0,
  commentCount: 4,
};

export default function MatchDesignPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return <PublicMatchDetail initialData={previewMatch} />;
}
