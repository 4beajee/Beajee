# Beajee Security and Reliability Remediation Plan

Status: local remediation complete; production rollout blocked pending target confirmation

Source: full-codebase audit performed 2026-06-30

Scope: all confirmed critical, high, medium, and low findings from the audit

## Execution Status — 2026-07-01

Completed locally:

- Phases 0–3 and 5–8 are implemented in focused commits with regression coverage.
- All 38 migrations apply to a clean PostgreSQL 16 + pgvector database with zero schema drift.
- Full tests, focused typecheck, production build, hardened Docker build, dependency audit,
  security-header check, and Git-history secret scan pass.
- `npm audit --omit=dev --audit-level=high` reports zero production vulnerabilities;
  the complete dependency tree has no high or critical advisories.

Still blocked before production deployment:

- Phase 4 requires the owner-confirmed Beajee droplet, directory, domain, database, nginx,
  and host marker. The private `deploy.md` still identifies a different Gennety target.
- The private `.env.production` contains malformed trailing content after `DIRECT_URL` and
  cannot currently be parsed by Docker Compose. It must be repaired without exposing values.
- The Git remote redirects from the legacy Gennety location to `4beajee/Beajee`; rollout
  configuration should be reconciled explicitly.
- Production credentials and all historical agent API keys must be rotated during the approved rollout.
- Production canary verification remains pending because no production mutation was authorized
  against a confirmed Beajee target.

## Objective

Restore Beajee's product invariants before production deployment:

- an authenticated agent may act only for its owner;
- negotiations remain private until humans explicitly publish a completed match;
- excluded sensitive topics never enter storage, embeddings, search, or delivery;
- blocks prevent all future discovery and contact;
- both agents and both owners must genuinely agree before chat opens;
- deployment can target only the confirmed Beajee production environment;
- external integrations cannot reach private infrastructure or fabricate success.

## Execution Rules

1. Critical exploit paths are closed before feature or performance work.
2. Every behavior change receives a regression test that fails against the old behavior.
3. Database behavior changes include both a forward migration and a data-repair step.
4. Each phase is committed separately. Existing user changes are excluded from remediation commits.
5. No deployment occurs until the final gate is fully green.
6. Any remediation that cannot be verified locally remains blocked rather than being marked complete.

## Phase 0 — Safety Baseline

Purpose: make later changes reviewable and prevent accidental production impact.

### Work

- Record the current branch, dirty files, dependency audit, test, lint, and build results.
- Keep existing user changes intact and inspect staged diffs before every commit.
- Disable use of the current `deploy.md` until the Beajee target is confirmed.
- Define reusable authenticated MCP execution context containing internal agent ID,
  external agent ID, and owner ID.

### Exit criteria

- Baseline commands and known failures are recorded.
- No remediation commit contains unrelated pre-existing changes.
- Production deployment remains explicitly blocked.

## Phase 1 — P0 Credential and Authorization Containment

Findings: `CRED-01`, `AUTHZ-01`, `CRED-02`, part of `AUTH-02`.

### 1.1 Personalized instructions

- Require either the authenticated owner session or the matching agent bearer token for
  `/api/soul/[agentId]`.
- Stop embedding reusable API keys in the SOUL response.
- Replace query-string setup credentials with a short-lived, one-use setup grant or an
  Authorization header.
- Add `Cache-Control: no-store` and a strict referrer policy to credential-bearing setup responses.
- Rotate all production agent API keys after the fixed version is deployed.

### 1.2 MCP identity binding

- Pass authenticated execution context into every MCP tool handler.
- Remove caller-controlled `owner_id` and `reporter_id` as authority sources.
- Require the authenticated agent to participate in every match/chat/call operation.
- Recheck authorization in the service layer so alternate transports cannot bypass it.
- Cover `confirm_match`, `mark_dormant`, `propose_match`, `block_user`, `archive_chat`,
  `report_chat`, call tools, context-question tools, and inbox acknowledgement.

### Tests

- Anonymous SOUL access returns 401 and never contains an API key.
- Agent A cannot act for Agent B's owner, match, chat, inbox, or call.
- A participant can still complete every permitted action.
- Both MCP transports enforce identical authorization.

### Exit criteria

- No public response contains a reusable agent credential.
- No tool accepts an identity claim that is not derived from authentication.
- All existing agent credentials are marked for rotation during rollout.

## Phase 2 — P0 Privacy and Publication Boundary

Findings: `PRIV-01`, `PRIV-02`, `PRIV-03`, `DATA-01`.

### 2.1 Private-by-default matches

- Change `Match.isPublic` default to `false`.
- Restrict feed queries to explicitly published, completed matches.
- Add an explicit authenticated publish/unpublish action with participant authorization.
- Never return negotiation logs, owner-specific framing, or raw agent reasoning publicly.
- Migrate every `NEGOTIATING`, `PROPOSED`, `DORMANT`, and `DECLINED` match to private.

### 2.2 Sensitive-topic enforcement

- Introduce a server-side privacy filter before context persistence and embedding.
- Reject or redact content matching excluded categories and return structured feedback.
- Apply the same filter to context-question answers, republishing, analytics metadata,
  model prompts, and public profile projections.
- Store only the filtered context snapshot as the searchable source of truth.

### 2.3 Atomic privacy changes

- Update exclusions, invalidate embeddings, mark context stale, and deactivate beacons in one transaction.
- Create delivery events only after the transaction commits.
- Limit `/api/profiles/[ownerId]` to a documented presentation-safe projection.

### Tests

- New negotiations are absent from anonymous feed/detail/search responses.
- Existing unfinished matches are private after migration.
- Every excluded category is rejected/redacted before the embedding client is called.
- A forced database failure cannot save exclusions while leaving the old embedding searchable.
- Arbitrary authenticated owners cannot retrieve private context fields.

### Exit criteria

- The private negotiation invariant is enforced by schema, queries, and tests.
- Sensitive exclusions are enforced by the server rather than agent instructions.

## Phase 3 — P0 Match Lifecycle Correctness

Findings: `FLOW-01`, `STATE-01`, `SAFE-01`, `RACE-01`.

### 3.1 Initiator and responder roles

- Derive roles solely from `initiatorAgentId`, never normalized A/B ordering.
- Fix check-in delivery, log roles, proposal permissions, reputation attribution,
  notification text, scheduling roles, and analytics attribution.
- Repair existing negotiations whose logs or pending recipient were assigned using normalized sides.

### 3.2 Blocks and lifecycle attempts

- Exclude either-direction blocks from search, beacon triggers, and recommendations.
- Add a final block check inside the match-creation transaction.
- Define explicit dormant resume behavior.
- Replace permanent pair uniqueness with versioned attempts or reactivate the existing lifecycle record.
- Make reaction toggles atomic and idempotent.

### Tests

- Both lexicographic agent orderings route to the real responder.
- A block immediately removes both parties from all discovery paths.
- Concurrent block/initiation cannot create a match.
- Dormant behavior matches the documented product contract.

### Exit criteria

- Both agent agreement and both owner confirmation remain mandatory.
- Normalized storage order has no behavioral meaning.

## Phase 4 — P0 Deployment Identity and Environment Repair

Finding: `DEPLOY-01` plus production configuration drift.

### Work

- Confirm the real Beajee droplet, repository, directories, container names, domains,
  database identity, and reverse-proxy configuration with the owner.
- Replace all Gennety paths and targets in `deploy.md` only after confirmation.
- Add a preflight script that compares expected app name, git remote, host marker,
  target directory, compose service, and database host before any sync or restart.
- Make deployment abort on any mismatch.
- Reconcile the production environment against `.env.example`, including cron,
  Telegram webhook/JWT, connector encryption, consent salt, and admin secrets.
- Bind the container port to loopback and verify TLS/security headers at nginx.

### Tests

- Preflight fails against the current Gennety inventory.
- Preflight succeeds only with an explicit Beajee host marker and expected identifiers.
- A dry-run deploy lists the exact files and target without writing.

### Exit criteria

- Deployment has one confirmed target and fails closed everywhere else.
- No build or deploy command receives secrets as Docker build arguments.

## Phase 5 — P1 External Integrations and Scheduling

Findings: `SSRF-01`, `CAL-01`, `CALL-01`, `SCHED-01`, `HTTP-01`.

### 5.1 Calendar safety

- Validate ICS URLs as HTTPS public endpoints.
- Resolve DNS and reject loopback, private, link-local, metadata, and rebinding targets.
- Revalidate every redirect.
- Add connection/read deadlines and response-size limits.
- Treat private/busy events as occupied while discarding their descriptive fields.

### 5.2 Calls and scheduling

- Remove deterministic fake Zoom URL generation.
- Integrate real Zoom meeting creation or switch the feature to a provider that can be provisioned and verified.
- Validate proposed times, ordering, duration, horizon, and duplicates.
- Make proposal replacement and confirmation atomic with conditional updates.

### Tests

- SSRF cases fail for direct IPs, DNS results, redirects, IPv6, and metadata ranges.
- Private calendar events block availability without exposing titles or descriptions.
- A reported call link corresponds to a real provider resource.
- Concurrent confirmations accept exactly one proposal.

### Exit criteria

- External fetches are bounded and cannot access private infrastructure.
- The product never reports a meeting as created unless the provider confirms it.

## Phase 6 — P1 Authentication, Abuse, and Dependencies

Findings: `AUTH-01`, `AUTH-02`, `DEP-01`, `ABUSE-01`, `IDENT-01`, `RESET-01`.

### Work

- Add durable IP/account-aware login throttling with exponential backoff.
- Normalize emails and migrate duplicate casing safely before enforcing uniqueness.
- Add session and agent-key versions so credential changes revoke old sessions/tokens.
- Persist OAuth access grants centrally and support explicit revocation.
- Consume password-reset tokens transactionally with the password update.
- Rate-limit public consent writes and other expensive endpoints.
- Upgrade Next.js, Hono/MCP transitive dependencies, next-intl, next-auth-compatible
  dependencies, and the lockfile until `npm audit` has no high findings.

### Tests

- Limits hold across process restarts and multiple application instances.
- Password/API-key rotation invalidates prior credentials immediately.
- Email casing cannot create a second identity.
- Dependency audit reports no high or critical vulnerabilities.

### Exit criteria

- Authentication abuse controls are durable and centrally enforced.
- No known high/critical dependency advisory remains.

## Phase 7 — P1/P2 Routing, Validation, and Data Contracts

Findings: `ROUTE-01`, `INPUT-01`, remaining `DATA-01`.

### Work

- Replace prefix-based public-route matching with exact, reviewed route policy.
- Test `/feed`, feed details, search, auth, Telegram, setup, cron, and admin routes independently.
- Add maximum lengths/counts and aggregate payload limits to context, search, beacon,
  negotiation, admin, Telegram, and connector inputs.
- Ensure every API route returns structured JSON except intentional documents/static responses.
- Apply explicit response DTOs rather than returning broad Prisma includes.

### Exit criteria

- Every route has an explicit authentication classification and automated test.
- Oversized payloads fail before database or provider work.

## Phase 8 — P2 Performance and Infrastructure Hardening

Findings: `PERF-01`, `PERF-02`, `INFRA-01`.

### Work

- Add measured HNSW/IVFFlat indexes for context and beacon vector searches.
- Add B-tree indexes for match participant/status/public/date, liveness, and feed access patterns.
- Replace per-chat unread count loops with grouped queries.
- Add CSP, HSTS, and verified proxy headers.
- Move build secrets to runtime or BuildKit secret mounts.
- Add dependency and secret scanning to CI.

### Tests

- Capture `EXPLAIN (ANALYZE, BUFFERS)` baselines on representative data.
- Assert bounded query counts for chat/feed endpoints.
- Verify security headers and direct-port isolation from outside the host.

### Exit criteria

- Critical queries use intended indexes and avoid N+1 behavior.
- Production exposure is only through the approved reverse proxy.

## Phase 9 — Final Verification and Re-audit

### Automated gate

- `npm ci`
- `npx prisma validate`
- apply all migrations to a fresh PostgreSQL + pgvector database
- apply all migrations to a production-like schema snapshot
- `npm run lint`
- `npx tsc --noEmit`
- `npm test`
- real-database integration tests
- concurrency tests for confirmation, blocks, reactions, and scheduling
- `npm run build`
- `npm audit --audit-level=high`
- secret scan across the working tree and git history

### Adversarial gate

- Repeat all 30 audit reproductions against the fixed build.
- Enumerate every HTTP/MCP/Telegram entry point and verify authentication and ownership.
- Verify private context never appears in feed, search, logs, analytics, or model prompts.
- Exercise anonymous, normal owner, blocked owner, unrelated agent, participant agent,
  admin, cron, and Telegram identities.
- Test dependency, SSRF, rate-limit, malformed-input, race, and rollback paths.

### Production canary gate

- Deploy only after Phase 4 target confirmation.
- Run smoke tests on onboarding, publish context, matching, negotiation, proposal,
  dual confirmation, chat, scheduling, Telegram, feed, privacy tightening, and blocking.
- Monitor errors, latency, database load, provider failures, and privacy-related events.
- Keep an immediate rollback path and rotate exposed credentials after successful rollout.

### Definition of done

- All critical and high findings are closed with passing regression tests.
- Medium and low findings are either closed or explicitly accepted in writing.
- A fresh full audit finds no critical/high issues and no regression of product invariants.
- Tests, lint, typecheck, build, migrations, dependency audit, and secret scan are green.
- Production canary confirms the same behavior outside the local environment.

## Planned Commit Sequence

1. `security: bind MCP actions to authenticated agent identity`
2. `security: protect personalized agent instructions and setup credentials`
3. `privacy: make matches private and enforce sensitive exclusions`
4. `matching: fix initiator routing blocks and dormant lifecycle`
5. `ops: replace deployment identity and add fail-closed preflight`
6. `security: harden calendar connectors and external requests`
7. `calls: provision real meetings and make scheduling atomic`
8. `auth: add durable limits revocation and normalized identities`
9. `deps: remove high-severity advisories`
10. `api: make route policy and payload contracts explicit`
11. `perf: add indexes and eliminate unread-count N+1 queries`
12. `hardening: secure container build networking and headers`
13. `test: add full adversarial regression and production-like integration suite`
