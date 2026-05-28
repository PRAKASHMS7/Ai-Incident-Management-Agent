"""
Redis Checkpoint Saver Module.

Implements LangGraph's BaseCheckpointSaver interface to persist graph execution state
snapshots to Redis, enabling resuming and failure recovery per incident.
Supports both synchronous and asynchronous execution paths.
"""

import logging
import pickle
from typing import Iterator, AsyncIterator, Optional, Any
from langchain_core.runnables import RunnableConfig
from langgraph.checkpoint.base import (
    BaseCheckpointSaver,
    Checkpoint,
    CheckpointMetadata,
    CheckpointTuple,
    ChannelVersions
)

from src.database.redis_client import redis_manager

logger = logging.getLogger(__name__)

class RedisCheckpointSaver(BaseCheckpointSaver):
    """
    Saves LangGraph checkpoints to Redis for state persistence and recovery.
    Provides both sync and async methods.
    """
    def __init__(self) -> None:
        super().__init__()

    def get_tuple(self, config: RunnableConfig) -> Optional[CheckpointTuple]:
        """
        Retrieves a checkpoint state tuple from Redis by thread ID.
        """
        thread_id = config["configurable"]["thread_id"]
        checkpoint_ns = config["configurable"].get("checkpoint_ns", "")
        
        redis_key = f"checkpoint:{thread_id}:{checkpoint_ns}"
        
        try:
            client = redis_manager.get_client()
            hex_data = client.get(redis_key)
            if not hex_data:
                logger.debug("No checkpoint found in Redis for key: %s", redis_key)
                return None
                
            checkpoint_data = pickle.loads(bytes.fromhex(hex_data))
            
            # Reconstruct CheckpointTuple
            return CheckpointTuple(
                config=config,
                checkpoint=checkpoint_data["checkpoint"],
                metadata=checkpoint_data["metadata"],
                parent_config=checkpoint_data.get("parent_config")
            )
        except Exception as e:
            logger.error("Failed to load checkpoint from Redis key %s: %s", redis_key, str(e))
            return None

    async def aget_tuple(self, config: RunnableConfig) -> Optional[CheckpointTuple]:
        """
        Asynchronously retrieves a checkpoint state tuple from Redis.
        """
        return self.get_tuple(config)

    def put(
        self,
        config: RunnableConfig,
        checkpoint: Checkpoint,
        metadata: CheckpointMetadata,
        new_versions: ChannelVersions
    ) -> RunnableConfig:
        """
        Saves a checkpoint state snapshot to Redis.
        """
        thread_id = config["configurable"]["thread_id"]
        checkpoint_ns = config["configurable"].get("checkpoint_ns", "")
        
        redis_key = f"checkpoint:{thread_id}:{checkpoint_ns}"
        
        try:
            checkpoint_data = {
                "checkpoint": checkpoint,
                "metadata": metadata,
                "parent_config": config.get("parent_config")
            }
            
            # Serialize using pickle and save with 24-hour expiration
            hex_data = pickle.dumps(checkpoint_data).hex()
            client = redis_manager.get_client()
            client.set(redis_key, hex_data, ex=86400)
            
            logger.debug("Saved state checkpoint in Redis: %s", redis_key)
        except Exception as e:
            logger.error("Failed to save checkpoint in Redis: %s", str(e))
            
        return config

    async def aput(
        self,
        config: RunnableConfig,
        checkpoint: Checkpoint,
        metadata: CheckpointMetadata,
        new_versions: ChannelVersions
    ) -> RunnableConfig:
        """
        Asynchronously saves a checkpoint state snapshot to Redis.
        """
        return self.put(config, checkpoint, metadata, new_versions)

    def list(
        self,
        config: Optional[RunnableConfig],
        *,
        before: Optional[RunnableConfig] = None,
        limit: Optional[int] = None
    ) -> Iterator[CheckpointTuple]:
        """
        Lists checkpoints.
        """
        return iter([])

    async def alist(
        self,
        config: Optional[RunnableConfig],
        *,
        before: Optional[RunnableConfig] = None,
        limit: Optional[int] = None
    ) -> AsyncIterator[CheckpointTuple]:
        """
        Asynchronously lists checkpoints.
        """
        # Yield nothing for the listing async iterator
        if False:
            yield None

    def put_writes(
        self,
        config: RunnableConfig,
        writes: Any,
        task_id: str,
        task_path: str = ""
    ) -> None:
        """
        Saves intermediate checkpoint writes to Redis.
        """
        thread_id = config["configurable"]["thread_id"]
        checkpoint_ns = config["configurable"].get("checkpoint_ns", "")
        redis_key = f"checkpoint:writes:{thread_id}:{checkpoint_ns}:{task_id}"
        
        try:
            hex_data = pickle.dumps(writes).hex()
            client = redis_manager.get_client()
            client.set(redis_key, hex_data, ex=86400)
        except Exception as e:
            logger.error("Failed to save checkpoint writes: %s", str(e))

    async def aput_writes(
        self,
        config: RunnableConfig,
        writes: Any,
        task_id: str,
        task_path: str = ""
    ) -> None:
        """
        Asynchronously saves intermediate checkpoint writes to Redis.
        """
        self.put_writes(config, writes, task_id, task_path)
