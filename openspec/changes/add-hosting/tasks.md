## 1. Images

- [x] 1.1 `deploy/api.Dockerfile`: cross-compiled publish, aspnet runtime, content included, non-root, port 8080
- [x] 1.2 `deploy/web.Dockerfile` and `deploy/Caddyfile`: client build, static files with SPA fallback, proxy routes, cache and security headers, site address from the environment
- [x] 1.3 `.dockerignore` so build contexts stay small

## 2. Stack and smoke test

- [x] 2.1 `deploy/compose.yml`: web, api, db, volumes, health checks, restart policy, environment file
- [x] 2.2 CI job `containers`: build amd64 images, start the stack over HTTP, run the smoke checks
- [x] 2.3 Run the stack and pass the same checks — in CI (pull request #29), not locally: Docker Desktop's engine was stopped on the development machine

## 3. Deployment

- [x] 3.1 `.github/workflows/deploy.yml`: on published releases (CI must have passed) and manually with a version tag; buildx multi-arch push to GHCR; SSH deploy; health check; rollback; image prune
- [x] 3.2 ~~Make the GHCR packages public~~ — not needed: the deploy logs the VM in to GHCR with the run's token (see design notes)

## 4. Server

- [x] 4.1 `deploy/bootstrap.sh`: Docker, unattended upgrades, deploy user, firewall, SSH hardening, backup timer; safe to rerun
- [x] 4.2 `deploy/backup.sh` with its systemd service and timer; tested in CI without an upload target (dumps and local retention) and on the VM by hand; the upload waits for `BACKUP_URL`

## 5. Docs

- [x] 5.1 `docs/hosting.md`: OCI account and VM, network rules, bucket and pre-authenticated request, GitHub environment, first deploy, domain switch, restore, troubleshooting
- [x] 5.2 Deployment section in `docs/architecture.md`; README pointer; D12 in `docs/decisions.md`

## 6. Validation

- [x] 6.1 `dotnet format`, `dotnet test`, `npm run check`, E2E and the container smoke test all pass in CI (no application code changed)
- [x] 6.2 Run `openspec validate add-hosting --strict`, push, and verify all CI jobs pass on the pull request
- [ ] 6.3 With the owner on the real VM: first deploy, a second deploy, a forced rollback, a backup and a restore, installing the app over HTTPS
