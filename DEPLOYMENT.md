# SRE Agent - Production Deployment Guide & Checklist

This document provides deployment operations and verification guidelines for running the SRE Incident Management Agent in production.

---

## 1. Production Container Architecture

The system runs as an isolated multi-container stack mapped via `docker-compose.prod.yml`:
- **Nginx (sre_proxy):** Terminates external HTTP traffic on port 80/443 and acts as a single API gateway.
- **Backend (sre_backend):** Stateless FastAPI service executing LangGraph loops. Runs as user `10001` (non-root).
- **Frontend (sre_frontend):** Minimal Alpine Nginx container serving compiled React SPA assets.
- **State Store (sre_redis):** Cache memory database running under authentication passwords.
- **Graph Database (sre_neo4j):** Service topology dependency store.
- **Scraper (sre_prometheus):** Self-observability scraping metrics registry.
- **AlertManager (sre_alertmanager):** Alert thresholds evaluator.

---

## 2. Secrets Management

Plaintext passwords must never be stored in codebase files.
- Set up target variables inside `.env.prod`:
  - `REDIS_PASSWORD`
  - `NEO4J_PASSWORD`
  - `GROQ_API_KEY`
  - `SLACK_BOT_TOKEN`
  - `SLACK_SIGNING_SECRET`
- In Kubernetes deployments, map external Secrets providers (e.g. AWS Secret Manager or Vault integration) to inject these values directly.

---

## 3. Production Deployment Execution

To deploy the production stack, execute:
```bash
./scripts/deploy_prod.sh
```

To roll back to previous stable container states in case of failure, execute:
```bash
./scripts/rollback.sh stable
```

---

## 4. Production Verification Checklist

Follow this checklist to confirm the environment is healthy post-deployment:

### [ ] 1. Core Service Connectivity
Verify all containers report healthy status:
```bash
docker compose -f docker-compose.prod.yml ps
```
All services (`sre_proxy`, `sre_backend`, `sre_frontend`, `sre_redis`, `sre_neo4j`, `sre_prometheus`, `sre_alertmanager`) must report `healthy`.

### [ ] 2. FastAPI Health Checks
Assert backend health endpoint returns operational status:
```bash
curl -f http://localhost:8000/health
```
Expected output:
```json
{"status":"healthy","components":{"redis":{"status":"healthy",...},"neo4j":{"status":"healthy",...}}}
```

### [ ] 3. Prometheus Scrape Configurations
Access metrics scrape page:
```bash
curl -s http://localhost:8000/metrics | grep incident_agent_heartbeat
```
Expected output should contain:
```
# HELP incident_agent_heartbeat Current timestamp representing the last heartbeat check of the watchdog daemon
# TYPE incident_agent_heartbeat gauge
incident_agent_heartbeat 177986XXXX.XX
```

### [ ] 4. Watchdog Heartbeat Status
Verify that `sre_backend` logs watchdog check passes:
```bash
docker logs sre_backend 2>&1 | grep "Watchdog check passed"
```

### [ ] 5. Slack Webhook Ingestion Verification
Post a test alert to `/alerts` and confirm it does not crash the server:
```bash
curl -i -X POST -H "Content-Type: application/json" \
  -d '{"receiver":"prometheus-webhook","status":"firing","alerts":[{"labels":{"alertname":"TestProdAlert","service":"payment-service","severity":"critical"},"annotations":{"summary":"Test Summary","description":"Test Description"},"startsAt":"2026-05-27T10:00:00Z"}]}' \
  http://localhost:8000/alerts
```
Expected Response: `HTTP/1.1 202 Accepted`

---

## 5. Backups & Restore Guide

### Neo4j Backups
To perform a daily Neo4j database dump:
```bash
./scripts/backup_neo4j.sh
```
To restore a dump file:
```bash
./scripts/restore_neo4j.sh ./storage/backups/neo4j_backup_XXXXXXXX.dump
```

### Redis Backups
To take a snapshot of active Redis keys:
```bash
./scripts/backup_redis.sh
```
To restore from a backup file:
```bash
./scripts/restore_redis.sh ./storage/backups/redis_backup_XXXXXXXX.rdb
```
