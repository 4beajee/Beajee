import { AgentPlatform } from "@/types/onboarding";
import { notFound } from "next/navigation";
import { ReconnectAgentPage } from "./reconnect-agent-page";

export default async function ReconnectPage({
  params,
  searchParams,
}: {
  params: Promise<{ platform: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { platform: rawPlatform } = await params;
  const { from } = await searchParams;
  const parsed = AgentPlatform.safeParse(rawPlatform);
  if (!parsed.success) notFound();
  const parsedPreviousPlatform = AgentPlatform.safeParse(from);

  return (
    <ReconnectAgentPage
      requestedPlatform={parsed.data}
      previousPlatform={parsedPreviousPlatform.success ? parsedPreviousPlatform.data : null}
    />
  );
}
