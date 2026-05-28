// Create Neo4j service constraints and indexes
CREATE CONSTRAINT unique_service_name IF NOT EXISTS
FOR (s:Service) REQUIRE s.name IS UNIQUE;

CREATE INDEX service_name_idx IF NOT EXISTS
FOR (s:Service) ON (s.name);
