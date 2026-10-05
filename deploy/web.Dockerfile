# syntax=docker/dockerfile:1
# The web server: Caddy with the built Angular client (deploy/Caddyfile). Build from the repository root:
#   docker buildx build -f deploy/web.Dockerfile --platform linux/arm64,linux/amd64 .
# The client builds once on the build machine; its output is the same for every platform.

FROM --platform=$BUILDPLATFORM node:24-bookworm-slim AS build
WORKDIR /client
ENV NG_CLI_ANALYTICS=false
COPY client/package.json client/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY client/ ./
RUN npm run build

FROM caddy:2
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /client/dist/slovion/browser /srv
