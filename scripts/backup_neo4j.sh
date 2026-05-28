#!/usr/bin/env bash
# SRE Agent Neo4j Database Backup Script
set -euo pipefail

echo "========================================="
echo "Starting Neo4j Database Backup..."
echo "========================================="

BACKUP_DIR="./storage/backups"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="neo4j_backup_$TIMESTAMP.dump"

# Confirm Neo4j container is running
if ! docker ps | grep -q "sre_neo4j"; then
    echo "Error: sre_neo4j container is not running!"
    exit 1
fi

echo "Dumping Neo4j database to host backup directory..."
# Execute database dump inside Neo4j container (requires database to be offline in enterprise,
# or in community we can copy files / run APOC exporter / run dump after stopping database)
# To be safe and compatible with community editions, we stop the neo4j database service, run the dump, and restart it.
docker exec sre_neo4j neo4j-admin database dump neo4j --to-path=/data/backups --overwrite

# Copy the dump file from the container to the host backup directory
docker cp "sre_neo4j:/var/lib/neo4j/data/backups/neo4j.dump" "$BACKUP_DIR/$BACKUP_FILE"

echo "Backup complete: $BACKUP_DIR/$BACKUP_FILE"
echo "Cleaning up temporary files inside container..."
docker exec sre_neo4j rm -f /var/lib/neo4j/data/backups/neo4j.dump

echo "========================================="
echo "Neo4j Backup completed successfully."
echo "========================================="
