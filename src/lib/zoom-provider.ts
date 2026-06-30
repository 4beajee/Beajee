interface ZoomMeetingInput {
  matchId: string;
  scheduledAt?: Date | null;
  durationMinutes?: number;
}

interface ZoomTokenResponse {
  access_token?: string;
}

interface ZoomMeetingResponse {
  id?: number | string;
  join_url?: string;
  password?: string;
}

const ZOOM_TIMEOUT_MS = 8_000;

export function isZoomConfigured() {
  return Boolean(
    process.env.ZOOM_ACCOUNT_ID &&
    process.env.ZOOM_CLIENT_ID &&
    process.env.ZOOM_CLIENT_SECRET
  );
}

async function zoomAccessToken() {
  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;
  if (!accountId || !clientId || !clientSecret) {
    throw new Error("Zoom provider is not configured");
  }

  const response = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      signal: AbortSignal.timeout(ZOOM_TIMEOUT_MS),
    }
  );
  if (!response.ok) throw new Error(`Zoom authentication failed (${response.status})`);
  const body = (await response.json()) as ZoomTokenResponse;
  if (!body.access_token) throw new Error("Zoom authentication returned no access token");
  return body.access_token;
}

export async function createZoomMeeting(input: ZoomMeetingInput) {
  const token = await zoomAccessToken();
  const scheduledAt = input.scheduledAt ?? new Date(Date.now() + 5 * 60_000);
  const response = await fetch("https://api.zoom.us/v2/users/me/meetings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      topic: `Beajee introduction ${input.matchId.slice(-8)}`,
      type: 2,
      start_time: scheduledAt.toISOString(),
      duration: Math.min(120, Math.max(15, input.durationMinutes ?? 30)),
      timezone: "UTC",
      settings: {
        waiting_room: true,
        join_before_host: false,
        approval_type: 2,
      },
    }),
    signal: AbortSignal.timeout(ZOOM_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Zoom meeting creation failed (${response.status})`);
  const body = (await response.json()) as ZoomMeetingResponse;
  if (!body.id || !body.join_url) {
    throw new Error("Zoom meeting creation returned an incomplete resource");
  }
  return {
    zoomUrl: body.join_url,
    zoomMeetingId: String(body.id),
    zoomPassword: body.password ?? null,
  };
}
