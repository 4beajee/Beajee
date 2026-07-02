# Hermes Founder Analytics

Status: private owner-only integration. This is not a Beajee user feature.

Hermes fetches one read-only weekly snapshot, interprets it with a fixed founder prompt, and delivers the result to a dedicated Telegram Topic. Beajee does not generate the summary and does not send it through the personal Beajee bot.

## Data flow

```text
Beajee aggregate analytics
        ↓
GET /api/admin/analytics/founder-weekly
        ↓  Bearer FOUNDER_ANALYTICS_SECRET
Hermes weekly cron + founder prompt
        ↓
telegram:<chat_id>:<thread_id>
```

The response contains the current seven days, the preceding seven days, and headline changes. It excludes emails, owner names, raw messages, negotiation logs, report narratives, and context text.

## 1. Configure Beajee

Generate a dedicated credential. Never reuse `ANALYTICS_ADMIN_SECRET` or an agent API key.

```bash
openssl rand -hex 32
```

Set the result as `FOUNDER_ANALYTICS_SECRET` in the Beajee production environment and restart the application.

## 2. Configure Hermes

Put the same value in the private Hermes environment file (`~/.hermes/.env` for the default profile):

```bash
BEAJEE_FOUNDER_ANALYTICS_SECRET="<the generated value>"
```

Do not paste the value into a cron prompt, chat message, skill, or committed file. The scheduled task must reference the environment variable at runtime.

The Hermes gateway must be running because it executes cron jobs and performs Telegram delivery.

## 3. Create the Telegram Topic job

Find the numeric Telegram group `chat_id` and the Topic `thread_id`. Hermes delivery uses this exact form:

```text
telegram:-1001234567890:17585
```

Send the following request to Hermes in chat, replacing only the delivery target and schedule if desired:

```text
Create a recurring cron job named "Beajee founder weekly analytics".

Schedule: 0 9 * * 1
Delivery: telegram:<chat_id>:<thread_id>
Set attach_to_session=true so I can discuss the result with you in that destination Topic.

Use this exact task prompt:

You are my founder analytics partner for Beajee. Fetch the private read-only JSON snapshot with one terminal request:

curl --fail --silent --show-error \
  --max-time 120 \
  -H "Authorization: Bearer ${BEAJEE_FOUNDER_ANALYTICS_SECRET}" \
  https://api.beajee.com/api/admin/analytics/founder-weekly

Analyze only the returned data. The snapshot contains the latest seven days, the preceding seven days, and explicit week-over-week changes.

Write in Russian and keep the full response under 600 words. Use this structure:

1. Коротко — 3–5 предложений с главным выводом недели.
2. Ключевые изменения — только важные изменения относительно предыдущей недели, с конкретными цифрами.
3. Сильные стороны — подтверждённые данными положительные закономерности.
4. Риски и слабые места — проблемы, аномалии и ухудшения, отсортированные по важности.
5. Что сделать — максимум три конкретных действия для меня как фаундера на следующую неделю.
6. Чего не хватает — дополнительные метрики только тогда, когда они действительно помогут принять решение; объясни зачем нужна каждая.

Rules:
- Separate facts from hypotheses. Label uncertain interpretations as hypotheses.
- Do not invent causes for changes.
- Do not treat a percentage change as meaningful when the previous value is zero or the sample is very small.
- Prefer product-loop metrics: onboarding, context publication, proposals, mutual confirmations, chats, scheduling, ghosting, reports, wake reliability, and cost.
- Mention missing or contradictory data explicitly.
- Never print, repeat, or reveal credentials.
- If the request fails or JSON is invalid, return a short failure notice with the HTTP/error detail and no fabricated summary.
```

The schedule above runs every Monday at 09:00 in the timezone configured for Hermes. Set the Hermes `timezone` configuration explicitly if the host timezone is not the one you want.

## 4. Verify before waiting a week

Ask Hermes to list the job, then run it immediately:

```text
/cron list
/cron run Beajee founder weekly analytics
```

Verify all four conditions:

1. Exactly one message arrives in the intended Telegram Topic.
2. It contains both week-over-week numbers and a short interpretation.
3. No credential or personal user data appears.
4. A reply in that Topic continues the analytics conversation with Hermes.

## Endpoint contract

- Method: `GET` only.
- Authentication: `Authorization: Bearer <FOUNDER_ANALYTICS_SECRET>`.
- Cache policy: `private, no-store`.
- Missing server configuration: `503` structured JSON.
- Missing or invalid credential: `401` structured JSON.
- Analytics failure: `500` with a generic message; internal details stay in server logs.

The credential grants no access to POST routes, moderation actions, normal admin analytics endpoints, MCP tools, or user accounts.
