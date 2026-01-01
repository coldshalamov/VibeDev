"""Pydantic models for VibeDev MCP entities.

This module defines the core domain models used throughout VibeDev MCP,
providing type safety, validation, and serialization for all entities.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class JobStatus(str, Enum):
    """Job lifecycle states."""

    PLANNING = "PLANNING"
    READY = "READY"
    EXECUTING = "EXECUTING"
    PAUSED = "PAUSED"
    COMPLETE = "COMPLETE"
    FAILED = "FAILED"
    ARCHIVED = "ARCHIVED"


class StepStatus(str, Enum):
    """Step execution states."""

    PENDING = "PENDING"
    ACTIVE = "ACTIVE"
    DONE = "DONE"
    SKIPPED = "SKIPPED"


class ModelClaim(str, Enum):
    """Model's self-evaluation claim for step completion."""

    MET = "MET"
    NOT_MET = "NOT_MET"
    PARTIAL = "PARTIAL"


class AttemptOutcome(str, Enum):
    """Outcome of a step submission attempt."""

    ACCEPTED = "accepted"
    REJECTED = "rejected"


class BlockType(str, Enum):
    """Types of context blocks."""

    RESEARCH = "RESEARCH"
    NOTES = "NOTES"
    PLAN = "PLAN"
    REPO_MAP = "REPO_MAP"
    DECISION = "DECISION"
    CONSTRAINTS = "CONSTRAINTS"
    SNIPPET = "SNIPPET"
    OUTPUT = "OUTPUT"
    FAILURE = "FAILURE"


class LogType(str, Enum):
    """Types of log entries."""

    DEVLOG = "DEVLOG"
    DECISION = "DECISION"
    POSTMORTEM = "POSTMORTEM"
    CHECKPOINT = "CHECKPOINT"
    SYSTEM = "SYSTEM"
    PROGRESS = "PROGRESS"


class EvidenceSchemaMode(str, Enum):
    """Evidence validation strictness."""

    LOOSE = "loose"
    STRICT = "strict"


class Policies(BaseModel):
    """Job policy configuration."""

    model_config = ConfigDict(extra="allow")

    require_devlog_per_step: bool = True
    require_commit_per_step: bool = False
    allow_batch_commits: bool = True
    require_tests_evidence: bool = True
    require_diff_summary: bool = True
    require_repo_snapshot_on_init: bool = False
    inject_invariants_every_step: bool = True
    inject_mistakes_every_step: bool = True
    evidence_schema_mode: EvidenceSchemaMode = EvidenceSchemaMode.LOOSE


class StepSpec(BaseModel):
    """Specification for a job step during planning."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    step_id: str | None = Field(default=None, description="Optional; auto-generated as S1..Sn")
    title: str = Field(..., min_length=1)
    instruction_prompt: str = Field(..., min_length=1)
    expected_outputs: list[str] = Field(
        default_factory=list,
        description="What to produce within this step (files/commands/notes).",
    )
    acceptance_criteria: list[str] = Field(default_factory=list)
    required_evidence: list[str] = Field(default_factory=list)
    remediation_prompt: str = Field(default="", description="Prompt to repair if criteria not met")
    context_refs: list[str] = Field(default_factory=list)


class Step(BaseModel):
    """A step in a job's execution plan."""

    model_config = ConfigDict(extra="allow")

    job_id: str
    step_id: str
    order_index: int
    title: str
    instruction_prompt: str
    expected_outputs: list[str] = Field(default_factory=list)
    acceptance_criteria: list[str] = Field(default_factory=list)
    required_evidence: list[str] = Field(default_factory=list)
    remediation_prompt: str = ""
    context_refs: list[str] = Field(default_factory=list)
    status: StepStatus = StepStatus.PENDING


class Evidence(BaseModel):
    """Evidence payload submitted with a step result."""

    model_config = ConfigDict(extra="allow")

    changed_files: list[str] = Field(default_factory=list)
    diff_summary: str | None = None
    commands_run: list[str] = Field(default_factory=list)
    tests_run: list[str] = Field(default_factory=list)
    tests_passed: bool | None = None
    lint_run: bool | None = None
    lint_passed: bool | None = None
    artifacts_created: list[str] = Field(default_factory=list)
    criteria_checklist: dict[str, bool] = Field(default_factory=dict)
    notes: str | None = None


class Attempt(BaseModel):
    """A submission attempt for a step."""

    model_config = ConfigDict(extra="allow")

    attempt_id: str
    job_id: str
    step_id: str
    timestamp: datetime
    model_claim: ModelClaim
    summary: str
    evidence: dict[str, Any]
    outcome: AttemptOutcome
    rejection_reasons: list[str] = Field(default_factory=list)
    missing_fields: list[str] = Field(default_factory=list)
    devlog_line: str | None = None
    commit_hash: str | None = None


class Job(BaseModel):
    """A VibeDev job with full state."""

    model_config = ConfigDict(extra="allow")

    job_id: str
    title: str
    goal: str
    status: JobStatus = JobStatus.PLANNING
    created_at: datetime
    updated_at: datetime
    repo_root: str | None = None
    policies: Policies = Field(default_factory=Policies)
    deliverables: list[str] = Field(default_factory=list)
    invariants: list[str] | None = None
    definition_of_done: list[str] = Field(default_factory=list)
    step_order: list[str] = Field(default_factory=list)
    current_step_index: int = 0
    planning_answers: dict[str, Any] = Field(default_factory=dict)


class ContextBlock(BaseModel):
    """A stored context block for job memory."""

    model_config = ConfigDict(extra="allow")

    context_id: str
    job_id: str
    block_type: str
    content: str
    tags: list[str] = Field(default_factory=list)
    created_at: datetime


class LogEntry(BaseModel):
    """A log entry (devlog, decision, etc.)."""

    model_config = ConfigDict(extra="allow")

    log_id: str
    job_id: str
    log_type: str
    content: str
    created_at: datetime
    step_id: str | None = None
    commit_hash: str | None = None


class MistakeEntry(BaseModel):
    """A recorded mistake in the failure ledger."""

    model_config = ConfigDict(extra="allow")

    mistake_id: str
    job_id: str
    title: str
    what_happened: str
    why: str
    lesson: str
    avoid_next_time: str
    tags: list[str] = Field(default_factory=list)
    created_at: datetime
    related_step_id: str | None = None


class RepoSnapshot(BaseModel):
    """A snapshot of repository state."""

    model_config = ConfigDict(extra="allow")

    snapshot_id: str
    job_id: str
    timestamp: datetime
    repo_root: str
    file_tree: str
    key_files: list[str] = Field(default_factory=list)
    notes: str | None = None


class RepoMapEntry(BaseModel):
    """A file description in the repo map."""

    model_config = ConfigDict(extra="allow")

    job_id: str
    path: str
    description: str
    updated_at: datetime


class PlanningQuestion(BaseModel):
    """A question in the planning interview."""

    phase: int
    key: str
    question: str
    rationale: str
    required_fields: list[str]
    required: bool = True


class SubmitResult(BaseModel):
    """Result of submitting a step result."""

    accepted: bool
    feedback: str
    next_action: str  # RETRY, NEXT_STEP_AVAILABLE, JOB_COMPLETE
    missing_fields: list[str] = Field(default_factory=list)
    rejection_reasons: list[str] = Field(default_factory=list)


class StepPrompt(BaseModel):
    """The structured prompt for executing a step."""

    step_id: str
    prompt: str
    acceptance_criteria: list[str]
    required_evidence: dict[str, Any]
    invariants: list[str]
    relevant_mistakes: list[str]
    required_evidence_template: dict[str, Any]


class JobSummary(BaseModel):
    """Summary of a job for listing."""

    job_id: str
    title: str
    goal: str
    status: JobStatus
    created_at: datetime
    updated_at: datetime
    step_count: int = 0
    current_step_index: int = 0


class ExportBundle(BaseModel):
    """An exported job bundle."""

    format: str
    job: dict[str, Any] | None = None
    steps: list[dict[str, Any]] = Field(default_factory=list)
    content: str | None = None  # For markdown format
