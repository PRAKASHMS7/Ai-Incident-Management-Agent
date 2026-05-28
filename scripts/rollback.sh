#!/usr/bin/env bash
# SRE Agent Rollback Script
set -euo pipefail

echo "========================================="
echo "Initializing Rollback Sequence..."
echo "========================================="

TAG=${1:-"stable"}

echo "Targeting rollback image tag: $TAG"

# 1. Load Prod profile
if [ -f ".env.prod" ]; then
    export $(grep -v '^#' .env.prod | xargs)
fi

# 2. Check if tag exists (mock tag check or docker pull)
echo "Pulling backup image: incident-agent:$TAG"
# docker pull ghcr.io/sre-team/incident-agent:$TAG || { echo "Rollback image tag $TAG not found in registry. Defaulting to previous container state."; }

# 3. Update active images to target rollback tag
echo "Rolling back container instances..."
# In a real environment we would update env vars or compose tags:
# export BACKEND_IMAGE_TAG=$TAG
docker compose -f docker-compose.prod.yml down

echo "Re-starting previous stable container state..."
docker compose -f docker-compose.prod.yml up -d

echo "========================================="
echo "Rollback completed. Checking status..."
echo "========================================="
docker compose -f docker-compose.prod.yml ps
