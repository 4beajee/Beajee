import {
  detectSchedulingProvider,
  schedulingProviderLabel,
  type SchedulingProvider,
} from "@/lib/scheduling-url";

interface SchedulingOwner {
  id: string;
  name: string | null;
  schedulingUrl: string | null;
}

interface SchedulingMatchParties {
  initiatorOwner: SchedulingOwner;
  recipientOwner: SchedulingOwner;
}

export interface SchedulingRoleResolution {
  hostOwner: SchedulingOwner;
  guestOwner: SchedulingOwner;
  hostProvider: SchedulingProvider;
  hostProviderLabel: string;
}

export function resolveInitiatorAndRecipient(args: {
  agentA: { id: string; owner: SchedulingOwner };
  agentB: { id: string; owner: SchedulingOwner };
  initiatorAgentId: string | null;
}) {
  const initiatorIsA = args.initiatorAgentId
    ? args.initiatorAgentId === args.agentA.id
    : true;

  return {
    initiatorOwner: initiatorIsA ? args.agentA.owner : args.agentB.owner,
    recipientOwner: initiatorIsA ? args.agentB.owner : args.agentA.owner,
  } satisfies SchedulingMatchParties;
}

export function resolveSchedulingRoles(
  parties: SchedulingMatchParties
): SchedulingRoleResolution | null {
  const { initiatorOwner, recipientOwner } = parties;

  if (initiatorOwner.schedulingUrl) {
    const provider = detectSchedulingProvider(initiatorOwner.schedulingUrl);
    return {
      hostOwner: initiatorOwner,
      guestOwner: recipientOwner,
      hostProvider: provider,
      hostProviderLabel: schedulingProviderLabel(provider),
    };
  }

  if (recipientOwner.schedulingUrl) {
    const provider = detectSchedulingProvider(recipientOwner.schedulingUrl);
    return {
      hostOwner: recipientOwner,
      guestOwner: initiatorOwner,
      hostProvider: provider,
      hostProviderLabel: schedulingProviderLabel(provider),
    };
  }

  return null;
}

export function buildSchedulingDeliveryPayload(args: {
  ownerId: string;
  roles: SchedulingRoleResolution | null;
}) {
  if (!args.roles) {
    return {
      scheduling_role: "unavailable" as const,
      partner_scheduling_url: null,
      partner_scheduling_provider: null,
      scheduling_host_owner_name: null,
      delivery_instruction:
        "No Cal.com or Calendly link is available yet. Ask your owner for their booking link and call set_scheduling_url.",
    };
  }

  const isGuest = args.ownerId === args.roles.guestOwner.id;
  const isHost = args.ownerId === args.roles.hostOwner.id;

  if (isGuest) {
    return {
      scheduling_role: "guest" as const,
      partner_scheduling_url: args.roles.hostOwner.schedulingUrl,
      partner_scheduling_provider: args.roles.hostProvider,
      scheduling_host_owner_name: args.roles.hostOwner.name,
      delivery_instruction:
        "Deliver a short intro, then share the booking link once. The owner decides whether to book.",
    };
  }

  if (isHost) {
    return {
      scheduling_role: "host" as const,
      partner_scheduling_url: null,
      partner_scheduling_provider: args.roles.hostProvider,
      scheduling_host_owner_name: args.roles.hostOwner.name,
      delivery_instruction:
        "Deliver the intro only. Your owner's booking link was shared with the other side so only one meeting gets booked.",
    };
  }

  return {
    scheduling_role: "unavailable" as const,
    partner_scheduling_url: null,
    partner_scheduling_provider: null,
    scheduling_host_owner_name: null,
    delivery_instruction: "Deliver the intro. No booking link is assigned for this owner.",
  };
}