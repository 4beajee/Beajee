import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function getUnreadMessageCounts(
  ownerId: string,
  chatIds?: string[]
): Promise<Map<string, number>> {
  if (chatIds?.length === 0) return new Map();

  const chatFilter = chatIds
    ? Prisma.sql`AND c.id IN (${Prisma.join(chatIds)})`
    : Prisma.empty;
  const rows = await prisma.$queryRaw<Array<{ chat_id: string; unread_count: bigint | number }>>`
    SELECT c.id AS chat_id, COUNT(message.id) AS unread_count
    FROM chats c
    JOIN matches matched_pair ON matched_pair.id = c.match_id
    JOIN agents agent_a ON agent_a.id = matched_pair.agent_a_id
    JOIN agents agent_b ON agent_b.id = matched_pair.agent_b_id
    LEFT JOIN messages message
      ON message.chat_id = c.id
     AND message.from_owner <> ${ownerId}
     AND message.created_at > COALESCE(
       CASE WHEN agent_a.owner_id = ${ownerId} THEN c.last_read_by_a ELSE c.last_read_by_b END,
       '-infinity'::timestamptz
     )
    WHERE matched_pair.status = 'MATCHED'
      AND (agent_a.owner_id = ${ownerId} OR agent_b.owner_id = ${ownerId})
      ${chatFilter}
    GROUP BY c.id
  `;

  return new Map(rows.map((row) => [row.chat_id, Number(row.unread_count)]));
}
