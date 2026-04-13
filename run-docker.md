# Docker Commands

## Build command

- Open a terminal in the root of the project
- `docker build -f apps/api/Dockerfile -t travel-companion-backend .`

## Run docker image

- Open a terminal in the root of the project
- `docker run -d --name travel-companion-backend-run -p 3000:3000 --env-file <full path to backend env file> travel-companion-backend`

## Remove docker cache

- `docker builder prune`
