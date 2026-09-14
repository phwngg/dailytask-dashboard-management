# GitHub Actions CI/CD

Workflow: `.github/workflows/cicd.yml`. Production deploy runs from GitHub Actions and reaches the server through a temporary NetBird peer, then SSH. It does not require a runner on the server.

## What runs

- A Pull Request targeting `main` runs `go test ./...` in `backend/` and `npm ci` plus `npm run build` in `frontend/`. Pull Requests never deploy.
- A push to `main` builds and pushes a Docker image tagged with the full commit SHA and `latest`, then deploys the SHA-tagged image. To keep feedback fast, the test job is skipped on pushes and does not gate deployment. A failing or skipped PR check therefore does not prevent a direct push to `main` from deploying.
- `workflow_dispatch` can deploy only when run against `main`.

For the normal team path, open a Pull Request, wait for its checks, then merge it. If the team must prevent untested direct pushes, enable a `main` branch ruleset that requires Pull Requests and the CI test checks; the workflow itself intentionally keeps direct push deployment fast.

## One-time setup

Create a GitHub Environment named exactly `Netbird-Server` under **Settings → Environments**. Add these as **Environment secrets** (not variables):

| Secret | Value / purpose |
| --- | --- |
| `NETBIRD_SETUP_KEY` | Reusable, ephemeral setup key for a temporary CI peer. Put it in the dedicated CI group and allow only the server SSH route in the NetBird access policy. Keep the key private and rotate it if exposed. |
| `NETBIRD_MANAGEMENT_URL` | Optional. Set this only when using a self-hosted NetBird management server; omit it for NetBird Cloud. |
| `DEPLOY_SSH_PRIVATE_KEY` | Private half of a dedicated deploy SSH key. The matching public key must be in the deploy account's `~/.ssh/authorized_keys` on the server. Do not commit or share the private half. |
| `DEPLOY_KNOWN_HOSTS` | Independently verified SSH host-key line for `[100.82.195.220]:2222`. Do not trust an unverified `ssh-keyscan` result as proof of server identity. |

The workflow uses the repository's `GITHUB_TOKEN` to publish to GHCR and log the server into GHCR; the deploy job has `packages: write`. Ensure GitHub Actions is enabled and the package permissions allow this repository's workflow to publish and pull the image.

On the server, keep the production Compose file, `.env`, and persistent `data/` under `/home/neurosus/hailt-outsource-project/phwng-dashboard/`. The SSH account (`neurosus`) must be able to run Docker Compose without an interactive sudo prompt. The Compose project needs an `app` service with a working healthcheck because deploy waits for it to become healthy. Do not store the database or production `.env` in GitHub.

## Deploy behavior

The workflow builds `deployment/Dockerfile`, pushes the image to `ghcr.io/phwngg/dailytask-dashboard-management`, joins NetBird, and waits for SSH to become reachable. It uploads a generated `docker-compose.ci.yaml` override with the current commit's image and `pull_policy: always`, then runs Compose using both the server's `docker-compose.yml` and that override. This explicitly pulls the new image even if the server Compose sets `pull_policy: never`.

Only the `app` service is pulled and restarted. Server ports, `env_file`, volumes, database, and other Compose settings remain defined by the server file. The deploy waits up to 90 seconds for the app healthcheck; the GitHub run is successful only after Compose reports the service healthy. The override file remains in the server folder and is replaced on the next deployment.

Typical end-to-end time is around a few minutes and can approach five minutes depending on GitHub runner queueing, image build/cache, and NetBird/SSH connection time. Check the run under **Actions**; wait for the deploy job to show **Success** before using the updated app. A skipped test job on a `main` push is expected.

## Troubleshooting

- **Run is queued:** GitHub has not assigned a runner yet; this is not an SSH failure.
- **NetBird join or SSH probe fails:** check that the setup key is active, the CI peer is in the allowed group, the policy permits TCP `2222` to `100.82.195.220`, and `neurosus` accepts the matching public key.
- **Host key verification fails:** refresh `DEPLOY_KNOWN_HOSTS` only after verifying the server's host-key fingerprint through a trusted channel.
- **GHCR login/pull fails:** check the package access settings and that the workflow token can read/write the package.
- **`No such image` during Compose recreate:** confirm the CI override includes `pull_policy: always` and inspect the preceding `docker compose ... pull app` output. The production Compose file may keep its own `pull_policy`; the CI override takes precedence.
- **Health wait times out:** inspect the app container logs and `/api/health` on the server. Compose will fail the run rather than reporting an unverified deployment as successful.
