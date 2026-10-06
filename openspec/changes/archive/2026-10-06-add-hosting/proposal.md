# Proposal

## Why

Slovion only runs on a developer's machine. The owner wants it online, hosted for free and deployed automatically from GitHub:
- **Hosting:** one *Always Free* Arm VM on Oracle Cloud Infrastructure (OCI).
- **Address:** the VM's public IP via `sslip.io` with real HTTPS until a domain is bought. HTTPS is needed to install the app (PWA) and to protect the save token.
- **Deployment:** a published GitHub Release goes live, if CI passed for it (first planned as every merge to `main`; changed by the owner after the first deploy).
- **Backups:** a daily database backup copied to OCI Object Storage.
- **VM setup:** a runbook and one setup script, no Terraform.

## What Changes

- **Container images** for the two parts of the game, built for `linux/arm64` (the VM) and `linux/amd64` (CI):
  - `slovion-api`: the .NET API with the game content baked in
  - `slovion-web`: Caddy serving the built Angular client, proxying `/api`, `/content` and `/health` to the API, and getting HTTPS certificates automatically
- **A production stack** (`deploy/compose.yml`) of `web`, `api` and `db` (PostgreSQL 18):
  - only `web` is reachable from outside (ports 80 and 443)
  - the database keeps its data on a named volume and is never published
  - the API runs migrations at startup, as today
- **Release deployment** (`.github/workflows/deploy.yml`):
  1. when a release (not a pre-release) is published, or on a manual run with a version tag, check that CI passed for the tagged commit, then build both images and push them to the GitHub Container Registry, tagged with the commit and the version
  2. connect to the VM over SSH, write the configuration from GitHub secrets, pull and restart the stack
  3. wait for `/health`; on failure, roll back to the previous version and fail the run
- **A smoke test in CI:** on every pull request, build both images and start the whole stack over plain HTTP. Then check:
  - the client loads, including a deep link
  - `/health` answers
  - a new save can be created
  - a map can be downloaded
- **Backups:** a daily `pg_dump`, compressed and uploaded to an OCI Object Storage bucket.
  - The upload uses a write-only pre-authenticated URL, so no cloud credentials live on the VM.
  - The bucket deletes copies after 14 days; the VM also keeps the last 3.
  - The restore is documented and tested once.
- **VM setup:** `deploy/bootstrap.sh`, run once on a fresh Ubuntu VM, which:
  - installs Docker and enables automatic security updates
  - creates the deploy user, opens ports 80 and 443 in the host firewall, and turns off SSH password login
  - installs the backup timer
- **Docs:**
  - `docs/hosting.md`: the runbook for creating the OCI account and VM, the bucket, the GitHub secrets, the first deploy, switching to a domain, and restoring a backup
  - a deployment section in `docs/architecture.md`
  - the new decision **D12 — Hosting** in `docs/decisions.md`

## Capabilities

### New Capabilities

- **`hosting`:** container images, the production stack, configuration and secrets, release deployment with health check and rollback, backups, and VM setup.

### Modified Capabilities

None. The installable app already requires HTTPS outside `localhost`, which this change provides.

## Non-goals

- Buying the domain or setting up DNS; switching to it later is one configuration value plus a DNS record.
- Terraform or other infrastructure-as-code; staging or preview environments.
- Monitoring, alerting, log shipping, uptime checks.
- Horizontal scaling, Kubernetes, a CDN, or a managed database.
- Rate limiting or bot protection beyond what Caddy does by default.
- Any change to gameplay, the API contract or the data model.

## Impact

- **New files:**
  - `deploy/` (Dockerfiles, compose file, Caddyfile, bootstrap and backup scripts)
  - `.github/workflows/deploy.yml`
  - `docs/hosting.md`
- **CI:** a new container smoke-test job (amd64) on pull requests and `main`.
- **Server code:** none expected. Production settings come from environment variables (connection string, content path), which the API already reads.
- **Secrets:** stored only as GitHub environment secrets (`production`) and in the VM's generated `.env`, never in the repository. They are:
  - the SSH key and host, the database password, and the backup URL
  - the site address, kept as a variable
- **Cost:** none within OCI's Always Free limits. A Pay-As-You-Go account is recommended, because it avoids capacity limits and idle reclamation.
