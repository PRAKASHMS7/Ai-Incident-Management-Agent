"""
Slack Bolt Async Client Integration Service.

Provides Block Kit templates, dynamic channel routing, interactive action callbacks,
tenacity-protected Web API postings, and incident state synchronization.
"""

import logging
import asyncio
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import slack_sdk
from slack_bolt.async_app import AsyncApp
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log,
)

from src.config import settings
from src.database.redis_client import redis_manager
from src.api.schemas import TimelineItem
from src.observability.tracer import tracer
from src.observability.metrics import (
    slack_escalation_delivery_total,
    operator_acknowledgement_duration_seconds,
)

logger = logging.getLogger(__name__)

# Initialize Slack Bolt AsyncApp
slack_app = AsyncApp(
    token=settings.SLACK_BOT_TOKEN, signing_secret=settings.SLACK_SIGNING_SECRET
)


class SlackClient:
    """
    Service client wrapping Slack Bolt SDK integrations.
    """

    def __init__(self, app: AsyncApp = slack_app) -> None:
        self.app = app
        self.client = app.client

    # 1. Block Kit Message Builders
    @staticmethod
    def header_block(incident_id: str, severity: str) -> Dict[str, Any]:
        emoji = "🚨" if severity.lower() == "critical" else "⚠️"
        severity_str = "CRITICAL" if severity.lower() == "critical" else "WARNING"
        return {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": f"{emoji} {severity_str} INCIDENT ESCALATION - ID: {incident_id}",
                "emoji": True,
            },
        }

    @staticmethod
    def context_block(
        incident_id: str, timestamp: datetime, services: List[str]
    ) -> Dict[str, Any]:
        dt = timestamp
        if isinstance(dt, str):
            try:
                dt = datetime.fromisoformat(dt)
            except ValueError:
                dt = datetime.now(timezone.utc)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        epoch = int(dt.timestamp())
        formatted_time = f"<!date^{epoch}^{{date_long}} at {{time}}|{dt.isoformat()}>"
        return {
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": f"*Incident ID:* `{incident_id}` | *Triggered:* {formatted_time} | *Services Affected:* `{', '.join(services)}`",
                }
            ],
        }

    @staticmethod
    def hypotheses_block(hypotheses: List[Any]) -> Dict[str, Any]:
        text = "*Ranked Hypotheses:*\n\n"
        if not hypotheses:
            text += "_No hypotheses generated._"
        for h in hypotheses:
            pct = int(h.confidence_score * 100)
            green_blocks = "🟩" * (pct // 10)
            white_blocks = "⬜" * (10 - (pct // 10))
            bar = f"[{green_blocks}{white_blocks}] {pct}%"

            text += f"*{h.rank}. {h.hypothesis}*\n"
            text += f"  - *Confidence:* {bar}\n"
            text += f"  - *Evidence:* {', '.join(h.evidence)}\n"
            text += f"  - *Action:* {h.recommended_action}\n\n"
        return {"type": "section", "text": {"type": "mrkdwn", "text": text.strip()}}

    @staticmethod
    def actions_block(incident_id: str) -> Dict[str, Any]:
        return {
            "type": "actions",
            "block_id": "incident_action_buttons",
            "elements": [
                {
                    "type": "button",
                    "action_id": "slack_ack_incident",
                    "text": {"type": "plain_text", "text": "✅ Acknowledge"},
                    "style": "primary",
                    "value": incident_id,
                },
                {
                    "type": "button",
                    "action_id": "slack_resolve_incident",
                    "text": {"type": "plain_text", "text": "🛡️ Resolve"},
                    "style": "danger",
                    "value": incident_id,
                },
            ],
        }

    # 2. Dynamic Routing Lookup
    async def get_routing_channel(self, service_name: str) -> str:
        """
        Looks up dynamic slack channel mappings in Redis, falling back to configuration settings.
        """
        try:
            redis_client = redis_manager.get_client()
            channel = redis_client.hget("slack:channel_routing", service_name)
            if channel:
                logger.info(
                    "Slack dynamic routing MATCH: Service %s -> Channel %s",
                    service_name,
                    channel,
                )
                return channel
        except Exception as e:
            logger.warning(
                "Failed to query Redis slack dynamic channel routing mapping: %s",
                str(e),
            )

        logger.debug(
            "Slack routing FALLBACK: Service %s -> Default %s",
            service_name,
            settings.SLACK_CHANNEL,
        )
        return settings.SLACK_CHANNEL

    # 3. Web API wrapper protected by Tenacity Retries
    @retry(
        retry=retry_if_exception_type(slack_sdk.errors.SlackApiError),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=2, min=2, max=10),
        before_sleep=before_sleep_log(logger, logging.WARNING),
        reraise=True,
    )
    async def post_message_with_retry(
        self, channel: str, blocks: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Posts message to Slack API. Protected by Tenacity retries on SlackApiError/RateLimits.
        """
        with tracer.start_as_current_span("slack.post_message") as span:
            span.set_attribute("slack.channel", channel)

            # If credentials are mock, skip real call
            if settings.SLACK_BOT_TOKEN == "mock_token":
                logger.info(
                    "Mock Slack client post message triggered to channel: %s", channel
                )
                slack_escalation_delivery_total.labels(
                    channel=channel, status="success"
                ).inc()
                return {"ok": True, "ts": "mock_ts_12345", "channel": channel}

            try:
                response: Any = await self.client.chat_postMessage(
                    channel=channel,
                    blocks=blocks,
                    text="AI-Powered Incident Escalation Card",
                )
                slack_escalation_delivery_total.labels(
                    channel=channel, status="success"
                ).inc()
                span.set_attribute("slack.message_ts", str(response.get("ts") or ""))
                return response
            except Exception as e:
                slack_escalation_delivery_total.labels(
                    channel=channel, status="failed"
                ).inc()
                span.record_exception(e)
                raise e

    # 4. Escalation Dispatcher
    async def post_escalation_card(
        self, 
        incident_id: str, 
        channel: Optional[str] = None, 
        operator_notes: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Main SRE entry point for graph nodes to post Block Kit alerts.
        """
        with tracer.start_as_current_span("slack.post_escalation_card") as span:
            span.set_attribute("incident.id", incident_id)
            logger.info(
                "Constructing Slack Escalation Card for incident: %s", incident_id
            )

            # Retrieve incident details
            incident = await asyncio.to_thread(redis_manager.get_incident, incident_id)
            if not incident:
                logger.error(
                    "Incident %s not found in Redis. Slack post skipped.", incident_id
                )
                span.set_attribute("slack.error", "incident_not_found")
                return None

            # Determine target channel
            if channel:
                target_channel = channel
            else:
                primary_service = (
                    incident.services_affected[0]
                    if incident.services_affected
                    else "default"
                )
                target_channel = await self.get_routing_channel(primary_service)

                # Warning alerts routed to staging channel
                if incident.state == "open" and incident.severity == "warning":
                    target_channel = f"{target_channel}-staging"
                    logger.info(
                        "Routing Warning incident %s to staging approval channel: %s",
                        incident_id,
                        target_channel,
                    )

            # Assemble blocks
            blocks = [
                self.header_block(incident.id, incident.severity),
                self.context_block(
                    incident.id, incident.created_at, incident.services_affected
                ),
                {"type": "divider"},
                self.hypotheses_block(incident.hypotheses),
            ]

            if operator_notes:
                blocks.append({
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Additional Escalation Context:*\n{operator_notes}"
                    }
                })

            # Include actions buttons only if not resolved yet
            if incident.state in ["open", "analyzing", "awaiting_approval", "pending_approval"]:
                blocks.append(self.actions_block(incident.id))

            try:
                response = await self.post_message_with_retry(target_channel, blocks)

                # Save timeline action
                incident.timeline.append(
                    TimelineItem(
                        timestamp=datetime.now(timezone.utc),
                        event_type="agent_milestone",
                        source="system",
                        message=f"Incident escalation posted to channel {target_channel}.",
                        severity="info",
                    )
                )
                await asyncio.to_thread(redis_manager.save_incident, incident)
                return response
            except Exception as e:
                logger.error(
                    "Failed to post incident escalation card to Slack: %s", str(e)
                )
                # Failure fallback node path
                incident.timeline.append(
                    TimelineItem(
                        timestamp=datetime.now(timezone.utc),
                        event_type="escalation_failed",
                        source="system",
                        message=f"Escalation notification failed to deliver. Error: {str(e)}",
                        severity="error",
                    )
                )
                await asyncio.to_thread(redis_manager.save_incident, incident)
                span.record_exception(e)
                return None

    async def close(self) -> None:
        """Closes Slack HTTP Web Client."""
        # Clean shutdown operations
        pass


# Global singleton instance
slack_client = SlackClient()


# 5. Interactive Action Event Handlers
@slack_app.action("slack_ack_incident")
async def handle_ack_incident(ack, body, client, respond):
    """
    Listens for operator clicking 'Acknowledge' button on SRE Slack card.
    """
    await ack()
    incident_id = body["actions"][0]["value"]
    user_name = body["user"]["name"]
    user_id = body["user"]["id"]
    logger.info(
        "Slack action: Operator Acknowledge clicked by @%s for incident: %s",
        user_name,
        incident_id,
    )

    # 1. Update state in Redis
    incident = await asyncio.to_thread(redis_manager.get_incident, incident_id)
    if incident:
        # Record SRE operator acknowledgment duration in seconds
        # Handle datetime parsing offsets safely
        created_dt = incident.created_at
        if created_dt.tzinfo is not None:
            now_dt = datetime.now(created_dt.tzinfo)
        else:
            now_dt = datetime.now(timezone.utc)
        ack_duration = (now_dt - created_dt).total_seconds()
        operator_acknowledgement_duration_seconds.observe(ack_duration)

        incident.state = "analyzing"
        incident.timeline.append(
            TimelineItem(
                timestamp=datetime.now(timezone.utc),
                event_type="operator_action",
                source="slack_operator",
                message=f"Incident acknowledged by @{user_name} ({user_id}) via Slack.",
                severity="info",
            )
        )
        await asyncio.to_thread(redis_manager.save_incident, incident)

    # 2. Update the original Slack card (replace actions buttons with ack context block)
    container = body["container"]
    channel_id = container["channel_id"]
    message_ts = container["message_ts"]
    blocks = body["message"]["blocks"]

    # Reconstruct updated blocks, removing action buttons block
    updated_blocks = [
        b for b in blocks if b.get("block_id") != "incident_action_buttons"
    ]
    updated_blocks.append(
        {
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": f"✅ *Acknowledged by @{user_name}* at <!date^{int(datetime.now(timezone.utc).timestamp())}^{{date_long}} at {{time}}|{datetime.now(timezone.utc).isoformat()}>",
                }
            ],
        }
    )

    # Slack card update using respond (primary) or client.chat_update (fallback)
    try:
        await respond(
            replace_original=True,
            blocks=updated_blocks,
            text="Incident Escalation Card Acknowledged",
        )
    except Exception as e:
        logger.warning(
            "Failed to update Slack message card via respond: %s. Falling back to chat_update.",
            str(e),
        )
        if settings.SLACK_BOT_TOKEN != "mock_token":
            try:
                await client.chat_update(
                    channel=channel_id,
                    ts=message_ts,
                    blocks=updated_blocks,
                    text="Incident Escalation Card Acknowledged",
                )
            except Exception as ex:
                logger.error("Failed to update Slack message card via chat_update: %s", str(ex))


@slack_app.action("slack_resolve_incident")
async def handle_resolve_incident(ack, body, client, respond):
    """
    Listens for operator clicking 'Resolve' button on the Slack card.
    """
    await ack()
    incident_id = body["actions"][0]["value"]
    user_name = body["user"]["name"]
    user_id = body["user"]["id"]
    logger.info(
        "Slack action: Operator Resolve clicked by @%s for incident: %s",
        user_name,
        incident_id,
    )

    try:
        # 1. Update state in Redis
        incident = await asyncio.to_thread(redis_manager.get_incident, incident_id)
        if incident:
            incident.state = "resolved"
            incident.timeline.append(
                TimelineItem(
                    timestamp=datetime.now(timezone.utc),
                    event_type="operator_action",
                    source="slack_operator",
                    message=f"Incident marked resolved by @{user_name} ({user_id}) via Slack.",
                    severity="info",
                )
            )
            await asyncio.to_thread(redis_manager.save_incident, incident)
    except Exception as e:
        logger.error("Failed to update incident state in Redis: %s", str(e))

    try:
        # 2. Update the original Slack card (replace actions buttons with resolve context block)
        container = body["container"]
        channel_id = container["channel_id"]
        message_ts = container["message_ts"]
        blocks = body["message"]["blocks"]

        updated_blocks = [
            b for b in blocks if b.get("block_id") != "incident_action_buttons"
        ]
        updated_blocks.append(
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": f"🛡️ *Resolved by @{user_name}* at <!date^{int(datetime.now(timezone.utc).timestamp())}^{{date_long}} at {{time}}|{datetime.now(timezone.utc).isoformat()}>",
                    }
                ],
            }
        )
    except Exception as e:
        logger.error("Failed to construct updated Blocks for Slack: %s", str(e))
        return

    # Slack card update using respond (primary) or client.chat_update (fallback)
    try:
        await respond(
            replace_original=True,
            blocks=updated_blocks,
            text="Incident Escalation Card Resolved",
        )
    except Exception as e:
        logger.warning(
            "Failed to update Slack message card via respond: %s. Falling back to chat_update.",
            str(e),
        )
        if settings.SLACK_BOT_TOKEN != "mock_token":
            try:
                await client.chat_update(
                    channel=channel_id,
                    ts=message_ts,
                    blocks=updated_blocks,
                    text="Incident Escalation Card Resolved",
                )
            except Exception as ex:
                logger.error("Failed to update Slack message card via chat_update: %s", str(ex))

