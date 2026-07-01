# ── Stage 1: Dependencies ──────────────────────────────────────────
FROM node:22-alpine AS deps
RUN apk add --no-cache openssl
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma/

RUN npm ci
RUN npx prisma generate

# ── Stage 2: Build ─────────────────────────────────────────────────
FROM node:22-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY . .

# Only public values are baked into the client bundle. Runtime secrets are
# supplied to the final container and never enter image build layers.
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_LANDING_URL

ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_LANDING_URL=$NEXT_PUBLIC_LANDING_URL
# Some server modules construct clients while Next collects route metadata.
# Non-routable placeholders satisfy constructor validation without exposing or
# contacting production services; the runner receives real values at runtime.
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build"
ENV DIRECT_URL="postgresql://build:build@127.0.0.1:5432/build"
ENV NEXTAUTH_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_TELEMETRY_DISABLED=1
# The production droplet is small; allow Next/TypeScript to use swap during image builds.
ENV NODE_OPTIONS="--max-old-space-size=1536"

RUN npx prisma generate
RUN npm run build

# ── Stage 3: Production ───────────────────────────────────────────
FROM node:22-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy prisma schema for runtime migrations
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["./docker-entrypoint.sh"]
