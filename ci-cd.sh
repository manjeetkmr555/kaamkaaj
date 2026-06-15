#!/usr/bin/env bash
set -euo pipefail

# --- Variables ---
PEM_FILE="./LightsailDefaultKey-ap-south-1-kaamkaaj.pem"
HOST_IP="3.6.198.213"
SSH_USER="ubuntu"
REMOTE_DIR="~/kaamkaaj"
GIT_BRANCH="main"
COMPOSE_CMD="docker compose --env-file .env.prod -f docker-compose.prod.yml pull && docker compose --env-file .env.prod -f docker-compose.prod.yml up -d"

chmod 400 "$PEM_FILE"

echo "==> Connecting to ${SSH_USER}@${HOST_IP}..."
echo "==> Pulling origin/${GIT_BRANCH} and rebuilding services..."

ssh -i "$PEM_FILE" -o StrictHostKeyChecking=accept-new "${SSH_USER}@${HOST_IP}" bash -s <<EOF
set -euo pipefail
cd ${REMOTE_DIR}
git pull origin ${GIT_BRANCH}
${COMPOSE_CMD}
docker compose -f docker-compose.prod.yml ps
EOF

echo "==> Deploy complete."
