import { prisma } from "@/lib/db";
import { normalizeSchedulingUrl } from "@/lib/scheduling-url";

export async function setOwnerSchedulingUrl(args: {
  ownerId: string;
  schedulingUrl: string | null;
}) {
  const normalized =
    args.schedulingUrl === null || args.schedulingUrl === ""
      ? null
      : normalizeSchedulingUrl(args.schedulingUrl);

  const owner = await prisma.owner.update({
    where: { id: args.ownerId },
    data: { schedulingUrl: normalized },
    select: {
      id: true,
      schedulingUrl: true,
    },
  });

  return owner;
}

export async function getOwnerSchedulingUrl(ownerId: string) {
  const owner = await prisma.owner.findUnique({
    where: { id: ownerId },
    select: { schedulingUrl: true },
  });
  return owner?.schedulingUrl ?? null;
}