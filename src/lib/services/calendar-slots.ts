import { prisma } from "@/lib/db";
import { fetchCalendarPersonalItems } from "@/lib/connectors/personal/calendar";
import { decryptConnectorSecret } from "@/lib/connectors/personal/crypto";
import type { PersonalConnector } from "@prisma/client";

const SLOT_DURATION_MS = 30 * 60 * 1000;
const WINDOW_DAYS = 7;
const WORKDAY_START_HOUR = 9;
const WORKDAY_END_HOUR = 18;

interface TimeRange {
  start: Date;
  end: Date;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseDate(value: unknown): Date | null {
  const raw = asString(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function decryptPersonalConnectorToken(connector: PersonalConnector) {
  if (!connector.encryptedToken || !connector.tokenIv) return null;
  try {
    return decryptConnectorSecret(connector.encryptedToken, connector.tokenIv);
  } catch {
    return null;
  }
}

async function fetchOwnerBusyRanges(ownerId: string): Promise<TimeRange[]> {
  const connector = await prisma.personalConnector.findFirst({
    where: { ownerId, type: "CALENDAR", enabled: true },
  });
  if (!connector) return [];

  const config = asObject(connector.config);
  const token = decryptPersonalConnectorToken(connector);
  const items = await fetchCalendarPersonalItems(config, token);

  return items.flatMap((item): TimeRange[] => {
    const payload = asObject(item.rawPayload);
    const start = parseDate(payload.start);
    const end = parseDate(payload.end) ?? (start ? new Date(start.getTime() + SLOT_DURATION_MS) : null);
    if (!start || !end || end <= start) return [];
    return [{ start, end }];
  });
}

function mergeRanges(ranges: TimeRange[]): TimeRange[] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: TimeRange[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];
    if (current.start <= last.end) {
      last.end = new Date(Math.max(last.end.getTime(), current.end.getTime()));
    } else {
      merged.push(current);
    }
  }

  return merged;
}

function invertRanges(busy: TimeRange[], windowStart: Date, windowEnd: Date): TimeRange[] {
  const free: TimeRange[] = [];
  let cursor = windowStart;

  for (const block of busy) {
    if (block.start > cursor) {
      free.push({ start: cursor, end: block.start });
    }
    if (block.end > cursor) {
      cursor = block.end;
    }
  }

  if (cursor < windowEnd) {
    free.push({ start: cursor, end: windowEnd });
  }

  return free;
}

function clipToWorkHours(ranges: TimeRange[]): TimeRange[] {
  const clipped: TimeRange[] = [];

  for (const range of ranges) {
    const day = new Date(range.start);
    day.setUTCHours(0, 0, 0, 0);

    while (day <= range.end) {
      const workStart = new Date(day);
      workStart.setUTCHours(WORKDAY_START_HOUR, 0, 0, 0);
      const workEnd = new Date(day);
      workEnd.setUTCHours(WORKDAY_END_HOUR, 0, 0, 0);

      const start = new Date(Math.max(range.start.getTime(), workStart.getTime()));
      const end = new Date(Math.min(range.end.getTime(), workEnd.getTime()));

      if (end > start && end.getTime() - start.getTime() >= SLOT_DURATION_MS) {
        clipped.push({ start, end });
      }

      day.setUTCDate(day.getUTCDate() + 1);
    }
  }

  return clipped;
}

function splitIntoSlots(ranges: TimeRange[], durationMs: number, limit: number): TimeRange[] {
  const slots: TimeRange[] = [];

  for (const range of ranges) {
    let cursor = range.start;
    while (cursor.getTime() + durationMs <= range.end.getTime() && slots.length < limit) {
      const end = new Date(cursor.getTime() + durationMs);
      slots.push({ start: new Date(cursor), end });
      cursor = new Date(cursor.getTime() + durationMs);
    }
    if (slots.length >= limit) break;
  }

  return slots;
}

function intersectSlots(a: TimeRange[], b: TimeRange[]): TimeRange[] {
  const overlaps: TimeRange[] = [];

  for (const slotA of a) {
    for (const slotB of b) {
      const start = new Date(Math.max(slotA.start.getTime(), slotB.start.getTime()));
      const end = new Date(Math.min(slotA.end.getTime(), slotB.end.getTime()));
      if (end.getTime() - start.getTime() >= SLOT_DURATION_MS) {
        overlaps.push({ start, end });
      }
    }
  }

  return overlaps.sort((x, y) => x.start.getTime() - y.start.getTime());
}

export async function findOverlappingCallSlots(
  ownerAId: string,
  ownerBId: string,
  options?: { limit?: number; durationMinutes?: number }
) {
  const limit = options?.limit ?? 5;
  const durationMs = (options?.durationMinutes ?? 30) * 60 * 1000;
  const windowStart = new Date();
  const windowEnd = new Date(windowStart.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [busyA, busyB] = await Promise.all([
    fetchOwnerBusyRanges(ownerAId),
    fetchOwnerBusyRanges(ownerBId),
  ]);

  const hasCalendarA = busyA.length > 0 || !!(await prisma.personalConnector.findFirst({
    where: { ownerId: ownerAId, type: "CALENDAR", enabled: true },
    select: { id: true },
  }));
  const hasCalendarB = busyB.length > 0 || !!(await prisma.personalConnector.findFirst({
    where: { ownerId: ownerBId, type: "CALENDAR", enabled: true },
    select: { id: true },
  }));

  const freeA = clipToWorkHours(
    invertRanges(mergeRanges(busyA.filter((r) => r.end > windowStart && r.start < windowEnd)), windowStart, windowEnd)
  );
  const freeB = clipToWorkHours(
    invertRanges(mergeRanges(busyB.filter((r) => r.end > windowStart && r.start < windowEnd)), windowStart, windowEnd)
  );

  const slotsA = splitIntoSlots(freeA, durationMs, limit * 3);
  const slotsB = splitIntoSlots(freeB, durationMs, limit * 3);
  const overlapping = intersectSlots(slotsA, slotsB).slice(0, limit);

  return {
    overlappingSlots: overlapping.map((slot) => ({
      start: slot.start.toISOString(),
      end: slot.end.toISOString(),
    })),
    ownerAHasCalendar: hasCalendarA,
    ownerBHasCalendar: hasCalendarB,
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
  };
}

export const __test = {
  mergeRanges,
  intersectSlots,
  clipToWorkHours,
  splitIntoSlots,
};