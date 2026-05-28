# AI-Powered Incident Management Agent

This repository contains the AI-Powered Incident Management Agent, built with FastAPI, Redis, Neo4j, and LangGraph.

## Phase 1 Architecture & Foundation

The project includes:
- **FastAPI Application (`src/main.py`)** with unified and standalone health checks for Redis and Neo4j.
- **Redis Integration (`src/database/redis_client.py`)** with connection pooling and health checking.
- **Neo4j Integration (`src/database/neo4j_client.py`)** with driver connection management, verification, and check query testing.
- **Docker Compose Setup (`docker-compose.yml`)** orchestrating all dependencies.

## Setup & Running

1. **Prerequisites**: Docker & Docker Compose, Python 3.11+.
2. **Environment**: Copy `.env.example` to `.env`.
3. **Run with Docker Compose**:
   ```bash
   docker compose up -d --build
   ```
4. **Access Swagger UI**: Go to [http://localhost:8000/docs](http://localhost:8000/docs).
5. **Verify Health**:
   - E2E Health check: `GET http://localhost:8000/health`
   - Redis specific: `GET http://localhost:8000/health/redis`
   - Neo4j specific: `GET http://localhost:8000/health/neo4j`
