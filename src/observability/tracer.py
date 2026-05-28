"""
OpenTelemetry Instrumentation and Tracer configuration.

Hooks telemetry collection parameters and registers app tracers.
"""

import os
import logging
from typing import Any
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter
from opentelemetry.sdk.resources import Resource

logger = logging.getLogger(__name__)

# Configurable Service Name
SERVICE_NAME = os.getenv("OTEL_SERVICE_NAME", "incident-agent")

# Initialize Tracer Provider
resource = Resource.create(attributes={"service.name": SERVICE_NAME})
provider = TracerProvider(resource=resource)

# Configure exporter
exporter: Any = None
otlp_endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
otlp_protocol = os.getenv("OTEL_EXPORTER_OTLP_PROTOCOL", "grpc").lower()

if os.getenv("TRACING_ENABLED", "true").lower() == "true":
    try:
        if otlp_protocol == "http":
            from opentelemetry.exporter.otlp.proto.http.trace_exporter import (
                OTLPSpanExporter as HTTPOTLPSpanExporter,
            )

            # Endpoint formatting check for OTLP HTTP
            endpoint = otlp_endpoint or "http://localhost:4318/v1/traces"
            exporter = HTTPOTLPSpanExporter(endpoint=endpoint)
            logger.info(f"OpenTelemetry HTTP OTLP Exporter initialized to {endpoint}")
        else:
            from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import (
                OTLPSpanExporter as GRPCOTLPSpanExporter,
            )

            endpoint = otlp_endpoint or "http://localhost:4317"
            exporter = GRPCOTLPSpanExporter(endpoint=endpoint)
            logger.info(f"OpenTelemetry gRPC OTLP Exporter initialized to {endpoint}")
    except Exception as e:
        logger.warning(
            f"Failed to initialize OTLP exporter ({e}). Falling back to ConsoleSpanExporter."
        )
        exporter = ConsoleSpanExporter()
else:
    logger.info(
        "OpenTelemetry tracing disabled (TRACING_ENABLED=false). Falling back to ConsoleSpanExporter."
    )
    exporter = ConsoleSpanExporter()

# Add BatchSpanProcessor
span_processor = BatchSpanProcessor(exporter)
provider.add_span_processor(span_processor)

# Register globally
trace.set_tracer_provider(provider)
tracer = trace.get_tracer(SERVICE_NAME)
