# syntax=docker/dockerfile:1
# Build from monorepo root (see docker-compose: context ../..)
#
#   docker build -f apps/api/Dockerfile .

ARG BUN_VERSION=1

# ---- shared base: Bun + OpenSSL (Prisma engines) + pnpm -----------------------
FROM oven/bun:${BUN_VERSION}-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*
ARG PNPM_VERSION=10.28.2
RUN curl -fsSL "https://github.com/pnpm/pnpm/releases/download/v${PNPM_VERSION}/pnpm-linux-x64" -o /usr/local/bin/pnpm \
  && chmod +x /usr/local/bin/pnpm
WORKDIR /app

# ---- deps: maximize cache hits — only manifests until install ---------------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY patches ./patches
COPY apps/api/package.json ./apps/api/
COPY apps/mobile/package.json ./apps/mobile/
COPY packages/db/package.json ./packages/db/
COPY packages/types/package.json ./packages/types/

# Hoisted linker + API slice: install api DAG + @repo/db so prisma CLI (dev) resolves
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
  pnpm install --frozen-lockfile \
    --filter "@repo/api..." \
    --filter "@repo/db"

# ---- build: sources + prisma client + bun bundle ----------------------------
FROM deps AS build

COPY apps/api ./apps/api
COPY packages/db ./packages/db
COPY packages/types ./packages/types

# prisma.config reads DATABASE_URL; not used for `generate` but env must exist
ENV DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/postgres"

RUN pnpm --filter @repo/db run db:generate \
  && pnpm --filter @repo/api run build

# Mobile-only patchedDependencies break `pnpm deploy` when deps tree has no RN/Mapbox; API does not use those patches
RUN printf '%s\n' \
  "packages:" \
  "  - \"apps/*\"" \
  "  - \"packages/*\"" \
  "nodeLinker: hoisted" \
  > pnpm-workspace.yaml \
  && pnpm --filter @repo/api deploy /prod --legacy

# ---- runtime: slim Bun; no pnpm / devDependencies -----------------------------
FROM oven/bun:${BUN_VERSION}-slim AS runner
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /srv
ENV NODE_ENV=production

COPY --from=build --chown=bun:bun /prod/ ./
# Bundled entry resolves ../../data from /srv/dist → host paths under /data
COPY --from=build --chown=bun:bun /app/apps/api/src/data/ /data/

USER bun
EXPOSE 3000

CMD ["bun", "dist/index.js"]
