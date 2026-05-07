# Docker Commands

## Build command

- The API image must use the repo root as the Docker build context because it needs `patches/`, `packages/db`, `packages/types`, `pnpm-lock.yaml`, and `pnpm-workspace.yaml`.
- From the repo root:
- `docker build -f apps/api/Dockerfile -t travel-companion-backend .`
- From `apps/api`:
- `docker build -f Dockerfile -t travel-companion-backend ../..`

## Run docker image

- Open a terminal in the root of the project
- `docker run -d --name travel-companion-backend-run -p 3000:3000 --env-file <full path to backend env file> travel-companion-backend`
- The final container runs the bundled server with Bun and keeps only the runtime dependencies needed for external packages like `pg` and `sharp`.

## Compose build

- From `apps/api`:
- `docker compose build api`
- The compose file is configured to use `../..` as the build context.

## Compose scale

- `docker compose up` does not honor `deploy.replicas`.
- To run multiple API containers with this setup, use:
- `docker compose up -d --scale api=3`

## Remove docker cache

- `docker builder prune`
