## 1. Images

- [ ] 1.1 `deploy/api.Dockerfile`: cross-compiled publish, aspnet runtime, content included, non-root, port 8080
- [ ] 1.2 `deploy/web.Dockerfile` and `deploy/Caddyfile`: client build, static files with SPA fallback, proxy routes, cache and security headers, site address from the environment
- [ ] 1.3 `.dockerignore` so build contexts stay small

## 2. Stack and smoke test

- [ ] 2.1 `deploy/compose.yml`: web, api, db, volumes, health checks, restart policy, environment file
- [ ] 2.2 CI job `containers`: build amd64 images, start the stack over HTTP, run the smoke checks
- [ ] 2.3 Run the stack locally and pass the same checks

## 3. Deployment

- [ ] 3.1 `.github/workflows/deploy.yml`: on CI success on main and manually; buildx multi-arch push to GHCR; SSH deploy; health check; rollback; image prune
- [ ] 3.2 Make the GHCR packages public after the first push (documented step)

## 4. Server

- [ ] 4.1 `deploy/bootstrap.sh`: Docker, unattended upgrades, deploy user, firewall, SSH hardening, backup timer; safe to rerun
- [ ] 4.2 `deploy/backup.sh` with its systemd service and timer; tested against the local stack with a dummy upload target

## 5. Docs

- [ ] 5.1 `docs/hosting.md`: OCI account and VM, network rules, bucket and pre-authenticated request, GitHub environment, first deploy, domain switch, restore, troubleshooting
- [ ] 5.2 Deployment section in `docs/architecture.md`; README pointer; D12 in `docs/decisions.md`

## 6. Validation

- [ ] 6.1 Run `dotnet format --verify-no-changes`, `dotnet test`, `npm run check`, and the container smoke test locally; all succeed
- [ ] 6.2 Run `openspec validate add-hosting --strict`, push, and verify all CI jobs pass on the pull request
- [ ] 6.3 With the owner on the real VM: first deploy, a second deploy, a forced rollback, a backup and a restore, installing the app over HTTPS
