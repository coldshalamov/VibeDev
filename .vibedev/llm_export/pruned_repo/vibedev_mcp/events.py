"""SSE Event Manager for VibeDev.

This module provides Server-Sent Events (SSE) support for real-time
updates to connected clients.
"""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass
class SSEEvent:
    """Represents an SSE event."""
    event_type: str
    data: dict[str, Any]
    job_id: str | None = None
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    
    def to_sse_string(self) -> str:
        """Format as SSE message string."""
        payload = {
            "type": self.event_type,
            "data": self.data,
            "timestamp": self.timestamp,
        }
        if self.job_id:
            payload["job_id"] = self.job_id
        return f"data: {json.dumps(payload)}\n\n"


class SSEEventManager:
    """Manages SSE connections and event broadcasting."""
    
    def __init__(self):
        # Map of job_id -> set of asyncio.Queue instances
        self._subscribers: dict[str, set[asyncio.Queue]] = {}
        # Global subscribers (receive all events)
        self._global_subscribers: set[asyncio.Queue] = set()
        self._lock = asyncio.Lock()
    
    async def subscribe(self, job_id: str | None = None) -> asyncio.Queue:
        """
        Subscribe to events for a specific job or all events.
        
        Args:
            job_id: If provided, only receive events for this job.
                    If None, receive all events.
        
        Returns:
            An asyncio.Queue that will receive SSEEvent objects.
        """
        queue: asyncio.Queue = asyncio.Queue()
        
        async with self._lock:
            if job_id:
                if job_id not in self._subscribers:
                    self._subscribers[job_id] = set()
                self._subscribers[job_id].add(queue)
            else:
                self._global_subscribers.add(queue)
        
        return queue
    
    async def unsubscribe(self, queue: asyncio.Queue, job_id: str | None = None) -> None:
        """Remove a subscription."""
        async with self._lock:
            if job_id and job_id in self._subscribers:
                self._subscribers[job_id].discard(queue)
                if not self._subscribers[job_id]:
                    del self._subscribers[job_id]
            else:
                self._global_subscribers.discard(queue)
    
    async def publish(self, event: SSEEvent) -> None:
        """
        Publish an event to all relevant subscribers.
        
        The event will be sent to:
        - All global subscribers
        - All job-specific subscribers if event.job_id is set
        """
        async with self._lock:
            # Global subscribers
            for queue in self._global_subscribers:
                try:
                    queue.put_nowait(event)
                except asyncio.QueueFull:
                    pass  # Drop event if queue is full
            
            # Job-specific subscribers
            if event.job_id and event.job_id in self._subscribers:
                for queue in self._subscribers[event.job_id]:
                    try:
                        queue.put_nowait(event)
                    except asyncio.QueueFull:
                        pass


# Event type constants
EVENT_JOB_CREATED = "job_created"
EVENT_JOB_UPDATED = "job_updated"
EVENT_JOB_STATUS_CHANGED = "job_status_changed"
EVENT_STEP_STARTED = "step_started"
EVENT_STEP_COMPLETED = "step_completed"
EVENT_STEP_FAILED = "step_failed"
EVENT_ATTEMPT_SUBMITTED = "attempt_submitted"
EVENT_MISTAKE_RECORDED = "mistake_recorded"
EVENT_DEVLOG_APPENDED = "devlog_appended"
EVENT_CONTEXT_ADDED = "context_added"
EVENT_CONTEXT_UPDATED = "context_updated"
EVENT_CONTEXT_DELETED = "context_deleted"


def create_job_event(event_type: str, job_id: str, **data) -> SSEEvent:
    """Helper to create a job-related event."""
    return SSEEvent(
        event_type=event_type,
        job_id=job_id,
        data={"job_id": job_id, **data},
    )


def create_step_event(event_type: str, job_id: str, step_id: str, **data) -> SSEEvent:
    """Helper to create a step-related event."""
    return SSEEvent(
        event_type=event_type,
        job_id=job_id,
        data={"job_id": job_id, "step_id": step_id, **data},
    )


# Global event manager instance
_event_manager: SSEEventManager | None = None


def get_event_manager() -> SSEEventManager:
    """Get the global event manager instance."""
    global _event_manager
    if _event_manager is None:
        _event_manager = SSEEventManager()
    return _event_manager
