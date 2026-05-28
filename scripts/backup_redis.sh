#!/usr/bin/env bash
# SRE Agent Redis Database Backup Script
set -euo pipefail

echo "========================================="
echo "Starting Redis State Backup..."
echo "========================================="

# 1. Load Prod profile for REDIS_PASSWORD
if [ -f ".env.prod" ]; then
    export $(grep -v '^#' .env.prod | xargs)
fi

BACKUP_DIR="./storage/backups"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="redis_backup_$TIMESTAMP.rdb"

# Confirm Redis container is running
if ! docker ps | grep -q "sre_redis"; then
    echo "Error: sre_redis container is not running!"
    exit 1
fi

echo "Triggering Redis BGSAVE checkpoint..."
docker exec sre_redis redis-cli -a "${REDIS_PASSWORD:-password}" BGSAVE

echo "Waiting for background save to finalize..."
# Poll Redis for last save status
until [ "$(docker exec sre_redis redis-cli -a "${REDIS_PASSWORD:-password}" info persistence | grep rdb_bgsave_in_progress | cut -d: -f2 | tr -d '\r')" -eq 0 ]; do
    sleep 1
done

echo "Copying dump.rdb from container..."
docker cp "sre_redis:/data/dump.rdb" "$BACKUP_DIR/$BACKUP_FILE"

echo "Backup complete: $BACKUP_DIR/$BACKUP_FILE"
echo "========================================="
echo "Redis Backup completed successfully."
echo "========================================="
