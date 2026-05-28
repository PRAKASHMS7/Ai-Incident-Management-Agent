"""
LangGraph Workflow Orchestrator.

Compiles nodes, edges, conditional loops, and binds Redis checkpointing savers
for E2E state execution.
"""

import logging
from typing import Dict, List, Optional
from typing_extensions import TypedDict
from langgraph.graph import StateGraph, END

from src.api.schemas import StandardizedAlert, Hypothesis, TimelineItem
from src.graph.nodes import WorkflowNodes
from src.graph.checkpoint import RedisCheckpointSaver

logger = logging.getLogger(__name__)


class IncidentWorkflowState(TypedDict):
    """
    Graph execution context representation.
    """

    incident_id: str
    state: str
    services_affected: List[str]
    expanded_topology_services: List[str]
    raw_alerts: List[StandardizedAlert]
    collected_metrics: Dict[str, str]
    collected_logs: Dict[str, str]
    retry_count: int
    validation_error_message: Optional[str]
    timeline: List[TimelineItem]
    hypotheses: List[Hypothesis]


def check_validation_route(state: IncidentWorkflowState) -> str:
    """
    Conditional routing function evaluating if formatting errors trigger loop retries.
    """
    val_error = state.get("validation_error_message")
    retry_count = state.get("retry_count", 0)

    if val_error and retry_count < 3:
        logger.warning(
            "Conditional Router: Incomplete or malformed JSON detected. Routing back to [llm_reasoning] (retry count=%d). Error: %s",
            retry_count,
            val_error,
        )
        return "llm_reasoning"

    logger.info(
        "Conditional Router: Format validation OK or retry cap met. Routing to [slack_escalation]"
    )
    return "slack_escalation"


def build_workflow() -> StateGraph:
    """
    Initializes and builds the StateGraph.
    """
    workflow = StateGraph(IncidentWorkflowState)

    # 1. Add Nodes
    workflow.add_node("initialize_state", WorkflowNodes.initialize_state)  # type: ignore
    workflow.add_node("fetch_topology", WorkflowNodes.fetch_topology)  # type: ignore
    workflow.add_node("gather_telemetry", WorkflowNodes.gather_telemetry)  # type: ignore
    workflow.add_node("llm_reasoning", WorkflowNodes.llm_reasoning)  # type: ignore
    workflow.add_node("rank_hypotheses", WorkflowNodes.rank_hypotheses)  # type: ignore
    workflow.add_node("slack_escalation", WorkflowNodes.slack_escalation)  # type: ignore
    workflow.add_node("timeline_rca_info", WorkflowNodes.timeline_rca_info)  # type: ignore

    # 2. Add Transitions and Edges
    workflow.set_entry_point("initialize_state")
    workflow.add_edge("initialize_state", "fetch_topology")
    workflow.add_edge("fetch_topology", "gather_telemetry")
    workflow.add_edge("gather_telemetry", "llm_reasoning")
    workflow.add_edge("llm_reasoning", "rank_hypotheses")

    # 3. Add Conditional Routing Edge
    workflow.add_conditional_edges(
        "rank_hypotheses",
        check_validation_route,
        {"llm_reasoning": "llm_reasoning", "slack_escalation": "slack_escalation"},
    )

    workflow.add_edge("slack_escalation", "timeline_rca_info")
    workflow.add_edge("timeline_rca_info", END)

    return workflow


# Compile the workflow with the Redis checkpoint saver
compiled_workflow = build_workflow().compile(checkpointer=RedisCheckpointSaver())
