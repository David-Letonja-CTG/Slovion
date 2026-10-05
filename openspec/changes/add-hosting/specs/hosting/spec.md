## ADDED Requirements

### Requirement: Container images
The repository SHALL build two container images for `linux/arm64` and `linux/amd64`:
- **`slovion-api`:** the API published in Release mode, including the game content, running as a non-root user on port 8080
- **`slovion-web`:** a web server with the built client that proxies `/api/*`, `/content/*` and `/health` to the API and serves every other path from the client, falling back to `index.html` for paths that are not files

The web server SHALL serve `index.html`, `ngsw.json`, `ngsw-worker.js` and the web app manifest with `Cache-Control: no-cache`, and the client's hashed bundles with a long-lived `immutable` cache. It SHALL send `X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer`. It SHALL load nothing from third parties (D5).

#### Scenario: Both images build for both platforms
- **WHEN** the images are built from the repository for `linux/arm64` and `linux/amd64`
- **THEN** both builds succeed without CPU emulation

#### Scenario: Deep link
- **WHEN** a browser requests `/play` from the web image
- **THEN** it receives the client's `index.html`

#### Scenario: API through the web server
- **WHEN** a browser requests `/health` or `POST /api/saves` from the web image
- **THEN** the request reaches the API and its response is returned unchanged

### Requirement: Production stack
A compose file SHALL define the production stack: the web server, the API and PostgreSQL 18, with these rules:
- only the web server publishes ports (80 and 443)
- the database keeps its data on a named volume and is reachable only from the API
- the web server keeps its certificates on a named volume
- every service restarts unless stopped
- the API waits for a healthy database, and the web server for a healthy API

The image tag, the database password and the site address SHALL come from an environment file, never from the repository. With a host name as the site address, the web server SHALL obtain and renew a TLS certificate automatically and redirect HTTP to HTTPS. With `:80` it SHALL serve plain HTTP (for tests).

#### Scenario: HTTPS by host name
- **WHEN** the stack runs with site address `203-0-113-7.sslip.io` on a VM with that public IP
- **THEN** `https://203-0-113-7.sslip.io/` serves the game with a valid certificate, and `http://` redirects to it

#### Scenario: The database is not exposed
- **WHEN** the stack runs
- **THEN** no port of the database or the API is published on the host

#### Scenario: A restart keeps the data
- **WHEN** the stack is stopped and started again
- **THEN** existing saves are still there, and no new certificate is requested

### Requirement: Container smoke test in CI
On every pull request and push to `main`, CI SHALL build both images for `linux/amd64`, start the production stack over plain HTTP with a throwaway password, and check that:
- `/` and `/play` return the client
- `/health` returns 200
- `POST /api/saves` returns a save token
- a map under `/content/maps/` is served with `no-cache`

A failing check SHALL fail CI.

#### Scenario: A broken image fails CI
- **WHEN** a pull request makes the API image unable to start
- **THEN** the smoke test fails and the pull request shows a failed check

### Requirement: Continuous deployment
When the CI workflow succeeds on `main`, and when started manually, a deploy workflow SHALL:
1. build and push both images for both platforms to the GitHub Container Registry, tagged with the commit SHA and `latest`
2. connect to the production VM over SSH with a pinned host key, copy the compose file and backup script, and write the environment file from the `production` environment's secrets and variables with the new tag, keeping the previous tag
3. pull the images and restart the stack
4. wait up to 3 minutes for `https://<site address>/health` to return 200

If the health check fails, the workflow SHALL restore the previous tag, restart the stack with it, and fail. After a successful deploy it SHALL remove unused images on the VM. Secrets SHALL NOT appear in the repository or in workflow logs.

#### Scenario: A merge goes live
- **WHEN** a pull request is merged into `main` and CI passes
- **THEN** the deploy workflow runs, and afterwards the site serves the new commit's images

#### Scenario: A failed deploy rolls back
- **WHEN** the new version's health check doesn't pass within 3 minutes
- **THEN** the previous version is running again and the workflow run is marked failed

#### Scenario: CI fails on main
- **WHEN** the CI workflow fails on `main`
- **THEN** nothing is deployed

### Requirement: Database backups
Every day the production VM SHALL dump the database in PostgreSQL's custom format and upload it to OCI Object Storage through a pre-authenticated write URL, so no cloud credentials are stored on the VM. Each dump is named with its UTC time. The VM SHALL keep the newest 3 dumps locally, and the bucket SHALL delete dumps after 14 days. The hosting documentation SHALL describe how to restore a dump into the stack.

#### Scenario: Daily backup
- **WHEN** the backup timer fires
- **THEN** a new dump appears in the bucket and in the local folder, and only the newest 3 remain locally

#### Scenario: Restore
- **WHEN** an operator follows the documented restore steps with a dump
- **THEN** the saves in the dump are back in the running game

### Requirement: Server setup
A setup script SHALL prepare a fresh Ubuntu 24.04 Arm VM in one run:
- install Docker with the compose plugin, and enable automatic security updates
- create a deploy user allowed to run Docker, with the given public SSH key
- open ports 80 and 443 in the host firewall persistently
- disable SSH password login
- install the daily backup timer

Running it again SHALL NOT break an already prepared VM. The hosting documentation SHALL cover the one-time cloud steps:
- the account, the VM and the network rules for ports 80 and 443
- the backup bucket with its retention rule and pre-authenticated write URL
- the GitHub `production` environment's secrets and variables
- the first deploy, and switching the site address to a domain later

#### Scenario: A fresh VM
- **WHEN** the setup script runs on a new Ubuntu 24.04 Arm VM and the GitHub secrets are set
- **THEN** a manual run of the deploy workflow brings the game online at the configured address

#### Scenario: Switching to a domain
- **WHEN** the domain's DNS points at the VM and the `SITE_ADDRESS` variable is changed to it
- **THEN** the next deploy serves the game over HTTPS at the domain
