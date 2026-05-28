#!/usr/bin/env bash
# SRE Agent Redis State Restore Script
set -euo pipefail

echo "========================================="
echo "Starting Redis State Restore..."
echo "========================================="

BACKUP_FILE=${1:-""}

if [ -z "$BACKUP_FILE" ]; then
    echo "Error: Please specify the backup file path to restore!"
    echo "Usage: ./restore_redis.sh ./storage/backups/redis_backup_XXXX.rdb"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file not found at $BACKUP_FILE!"
    exit 1
fi

# Stop Redis container to avoid state corruption
echo "Stopping Redis container..."
docker compose -f docker-compose.prod.yml stop redis

echo "Copying backup file to container data directory..."
# We start a temporary container or copy files directly into the volume path.
# With Docker Compose, we can copy the dump file to the stopped container.
# Wait, docker cp works even on stopped containers!
docker cp "$BACKUP_FILE" "sre_redis:/data/dump.rdb"

echo "Restarting Redis container..."
docker compose -f docker-compose.prod.yml start redis

echo "========================================="
echo "Redis Restore completed successfully."
echo "========================================="
