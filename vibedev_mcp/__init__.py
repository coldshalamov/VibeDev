"""VibeDev MCP server package.

VibeDev MCP is a persistent development process brain that enforces
disciplined LLM coding workflows through phased planning and
evidence-based execution gating.
"""

from vibedev_mcp.conductor import (
    PlanningPhase,
    compute_next_questions,
    get_current_phase,
    get_phase_summary,
    validate_ready_transition,
)
from vibedev_mcp.store import VibeDevStore

__all__ = [
    "__version__",
    "VibeDevStore",
    "PlanningPhase",
    "compute_next_questions",
    "get_current_phase",
    "get_phase_summary",
    "validate_ready_transition",
]

__version__ = "0.1.0"
