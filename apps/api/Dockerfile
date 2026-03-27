# syntax=docker/dockerfile:1.7

FROM oven/bun:canary-alpine AS base
WORKDIR /workspace

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN apk add --no-cache nodejs npm && npm install -g pnpm@10.28.2

FROM base AS deps

# Copy only manifests first for better layer caching.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/types/package.json packages/types/package.json

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @repo/api...

FROM deps AS builder

COPY apps/api apps/api
COPY packages/db packages/db
COPY packages/types packages/types

RUN pnpm --filter @repo/db db:generate && pnpm --filter @repo/api build

FROM oven/bun:canary-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder --chown=bun:bun /workspace/apps/api/dist/index.js ./index.js

USER bun

EXPOSE 3000

CMD ["bun", "./index.js"]
