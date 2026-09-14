# GitHub Actions deploy setup

Pull requests run Go tests and build the frontend. Pushes to main go straight to building a Docker image tagged with the commit SHA, joining NetBird as a temporary CI peer, and deploying over SSH; they do not wait for the test job.

Before the first push to main:

1. In NetBird, create a dedicated setup key for CI. Set it to ephemeral, reusable, and assign it to a dedicated group. Add an access policy allowing that group to reach only 100.82.195.220:2222. For a self-hosted NetBird management server, also note its management URL.
2. In the GitHub repository, open Settings → Environments → Netbird-Server → Add secret and add NETBIRD_SETUP_KEY, DEPLOY_SSH_PRIVATE_KEY, and DEPLOY_KNOWN_HOSTS. If NetBird is self-hosted, add NETBIRD_MANAGEMENT_URL too. Set DEPLOY_KNOWN_HOSTS to the independently verified host-key line for [100.82.195.220]:2222.
3. Generate a dedicated Ed25519 SSH key without a passphrase for deployment and add its public key to neurosus authorized_keys. Ensure that account can run Docker Compose without an interactive sudo prompt. The workflow does not store or send the server sudo password.
4. Enable GitHub Actions for the repository. A push to main runs tests first, then deploys only after they pass.

The workflow keeps the server docker-compose.yml, .env, and data/ directory unchanged. It uploads a small docker-compose.ci.yaml image override and combines it with the existing Compose file when pulling and restarting only the app service. Existing ports, volumes, container settings, and other services remain defined by the server Compose file. The app image is pinned to the commit SHA.
