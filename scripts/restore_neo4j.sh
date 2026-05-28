#!/usr/bin/env bash
# SRE Agent Neo4j Database Restore Script
set -euo pipefail

echo "========================================="
echo "Starting Neo4j Database Restore..."
echo "========================================="

BACKUP_FILE=${1:-""}

if [ -z "$BACKUP_FILE" ]; then
    echo "Error: Please specify the backup file path to restore!"
    echo "Usage: ./restore_neo4j.sh ./storage/backups/neo4j_backup_XXXX.dump"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file not found at $BACKUP_FILE!"
    exit 1
fi

echo "Copying dump file to container..."
# Ensure backups folder exists inside container
docker exec sre_neo4j mkdir -p /var/lib/neo4j/data/backups
docker cp "$BACKUP_FILE" "sre_neo4j:/var/lib/neo4j/data/backups/neo4j.dump"

echo "Running Neo4j Admin database load..."
# Execute load command (replaces target database)
docker exec sre_neo4j neo4j-admin database load neo4j --from-path=/var/lib/neo4j/data/backups --overwrite

echo "Cleaning up temporary files inside container..."
docker exec sre_neo4j rm -f /var/lib/neo4j/data/backups/neo4j.dump

echo "Restarting Neo4j container to apply changes..."
docker compose -f docker-compose.prod.yml restart neo4j

echo "========================================="
echo "Neo4j Restore completed successfully."
echo "========================================="
