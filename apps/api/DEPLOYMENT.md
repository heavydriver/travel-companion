# API Docker + VPS Deployment

This deployment uses:

- `apps/api/Dockerfile` for building the API bundle and running it with Bun in production.
- `apps/api/docker-compose.yml` and `apps/api/Caddyfile` on the VPS.
- `.github/workflows/api-docker-deploy.yml` for CI/CD.

## Docker Hub image

- Repository name: `travel-companion-backend`
- Final image format: `<DOCKERHUB_USERNAME>/travel-companion-backend:<TAG>`
- CI tag format (semantic version): `<major>.<minor>.<patch>`
  - Example: `1.3.2`
- CI also publishes `latest` on each successful `main` deployment.

## Build context requirement

- `apps/api/Dockerfile` must be built with the repository root as the Docker build context.
- Reason: the image build needs repo-root workspace files and shared packages:
  - `patches/`
  - `pnpm-lock.yaml`
  - `pnpm-workspace.yaml`
  - `packages/db`
  - `packages/types`
- Valid examples:
  - From repo root: `docker build -f apps/api/Dockerfile -t travel-companion-backend .`
  - From `apps/api`: `docker build -f Dockerfile -t travel-companion-backend ../..`
- `apps/api/docker-compose.yml` is configured with `build.context: ../..` for this reason.

## Required GitHub secrets

Set these in repository secrets:

- `DOCKERHUB_USERNAME`: Docker Hub account/org name
- `DOCKERHUB_TOKEN`: Docker Hub access token (read/write packages)
- `VPS_HOST`: VPS hostname or IP
- `VPS_USER`: SSH user on VPS
- `VPS_SSH_KEY`: private SSH key used by GitHub Actions
- `VPS_PORT` (optional): SSH port (defaults to `22`)
- `VPS_DEPLOY_PATH` (optional): directory on VPS containing `docker-compose.yml`
  - Default used by workflow: `$HOME/travel-companion/apps/api`

## VPS runtime files

In your VPS deploy directory (`VPS_DEPLOY_PATH`), keep:

- `docker-compose.yml`
- `Caddyfile`
- `.env` (not committed) for API runtime env vars:
  - `DATABASE_URL`
  - `JWT_ACCESS_SECRET`
  - `JWT_REFRESH_SECRET`
  - optional values from `apps/api/.env.example`
  - Better Stack / OpenTelemetry envs when telemetry export is enabled:
    - `BETTERSTACK_INGESTING_HOST`
    - `BETTERSTACK_SOURCE_TOKEN`
    - `OTEL_SERVICE_NAME` (optional, defaults to `travel-companion-api`)
    - `SERVICE_VERSION` (recommended, usually set to deploy tag)
    - `OTEL_METRIC_EXPORT_INTERVAL_MS` (optional)
    - `OTEL_METRIC_EXPORT_TIMEOUT_MS` (optional)
- `.env` (same file) or shell environment with:
  - `DOCKERHUB_USERNAME`
  - `IMAGE_TAG` (workflow exports this before `docker compose` commands)
  - `CADDY_DOMAIN`

## Workflow behavior

- Trigger: pushes to `main` when files in `apps/api` (and related workspace deps/config) change.
- CI gate: runs `pnpm --filter @repo/api typecheck` and runs `bun test` when API test files exist.
- Semantic versioning: runs `cycjimmy/semantic-release-action` in `apps/api` using `api-vX.Y.Z` git tags for monorepo-safe API releases.
- Build + publish: builds `apps/api/Dockerfile` and pushes `<DOCKERHUB_USERNAME>/travel-companion-backend:X.Y.Z`.
- Deploy: SSH to VPS, optional `git pull`, then:
  - `docker compose pull api`
  - `docker compose up -d --remove-orphans`

## Scaling

- `apps/api/docker-compose.yml` is written for plain Docker Compose, not Docker Swarm.
- Because of that, Compose ignores `deploy.replicas`, so scaling should be done from the command line:
  - `docker compose up -d --scale api=3`
- If you want 3 API containers on the VPS, use that scaled command in place of the plain `docker compose up -d --remove-orphans`.

## Notes

- No `.env` files are copied into the Docker image.
- Secrets are injected only at runtime or through GitHub secrets.
- API package version and changelog are updated automatically by semantic-release.
- Health endpoints for Better Stack uptime monitors:
  - `GET /api/v1/health/live`
  - `GET /api/v1/health/ready`
- `apps/api/Dockerfile` bundles the API to `dist/index.js` and runs it with Bun instead of `bun build --compile`.
- The runtime image still includes `node_modules` for external runtime dependencies so `pg` stays external and OpenTelemetry can instrument PostgreSQL in production.
- The runtime dependency layer is generated from `apps/api/package.json`, so `pg` and `sharp` stay version-aligned with the app package automatically.
- CI/Docker install uses `pnpm install --config.node-linker=isolated ...` because Bun on this API package needs package-local links for OpenTelemetry modules.
- The Compose file sets `stop_grace_period: 20s` so the API has time to stop cleanly and flush telemetry on shutdown.
