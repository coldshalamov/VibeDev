from __future__ import annotations

import argparse
import json
import sys
import os
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from mcp.server.fastmcp import Context, FastMCP
from pydantic import BaseModel, ConfigDict, Field

from vibedev_mcp.conductor import compute_next_questions
from vibedev_mcp.models import ModelClaim
from vibedev_mcp.store import VibeDevStore
from vibedev_mcp.templates import get_template, list_templates


def _default_db_path() -> Path:
    return Path.home() / ".vibedev" / "vibedev.sqlite3"


@dataclass(frozen=True)
class AppState:
    store: VibeDevStore


@asynccontextmanager
async def _lifespan(_: FastMCP):
    db_path = Path(os.environ.get("VIBEDEV_DB_PATH", str(_default_db_path())))
    store = await VibeDevStore.open(db_path)
    try:
        yield AppState(store=store)
    finally:
        await store.close()


mcp = FastMCP(
    "vibedev_mcp",
    json_response=True,
    lifespan=_lifespan,
    instructions=(
        "VibeDev MCP is a persistent process brain and prompt-chain conductor.\n"
        "Use Planning tools to build a job (deliverables/invariants/DoD/steps), then run Execution tools step-by-step.\n"
        "This server enforces evidence-first execution: it will not advance steps without required evidence keys."
    ),
)

DEFAULT_POLICIES: dict[str, Any] = {
    "require_devlog_per_step": True,
    "require_commit_per_step": False,
    "allow_batch_commits": True,
    "require_tests_evidence": True,
    "require_diff_summary": True,
    "require_repo_snapshot_on_init": False,
    "inject_invariants_every_step": True,
    "inject_mistakes_every_step": True,
    "evidence_schema_mode": "loose",
    "max_retries_per_step": 2,
    "retry_exhausted_action": "PAUSE_FOR_HUMAN",
    # Safety: shell-executing gates are opt-in and allowlisted per job.
    "enable_shell_gates": False,
    "shell_gate_allowlist": [],
}


class ConductorInitInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    title: str = Field(..., min_length=1, description="Job title")
    goal: str = Field(..., min_length=1, description="Goal statement")
    repo_root: str | None = Field(default=None, description="Absolute repo root path (optional)")
    policies: dict[str, Any] | None = Field(
        default=None,
        description="Optional policy toggles (require_devlog_per_step, require_commit_per_step, etc.)",
    )


@mcp.tool(
    name="conductor_init",
    annotations={
        "title": "Create a new job and start the planning interview",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": False,
        "openWorldHint": False,
    },
)
async def conductor_init(params: ConductorInitInput, ctx: Context) -> dict[str, Any]:
    """Create a new job in PLANNING mode and return onboarding questions."""
    store = ctx.request_context.lifespan_context.store
    policies = dict(DEFAULT_POLICIES)
    if params.policies:
        policies.update(params.policies)
    job_id = await store.create_job(
        title=params.title,
        goal=params.goal,
        repo_root=params.repo_root,
        policies=policies,
    )
    job = await store.get_job(job_id)
    snapshot = None
    if policies.get("require_repo_snapshot_on_init") and params.repo_root:
        snapshot = await store.repo_snapshot(job_id=job_id, repo_root=params.repo_root, notes="init")
    questions = compute_next_questions(job)
    return {
        "job_id": job_id,
        "status": job["status"],
        "next_questions": [q["question"] for q in questions],
        "instructions": "Answer the questions, then call conductor_answer with an answers object.",
        "repo_snapshot": snapshot,
    }


class JobIdInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    job_id: str = Field(..., min_length=1)


class ConductorNextQuestionsInput(JobIdInput):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    last_answers: dict[str, Any] | None = Field(
        default=None,
        description="Optional last answers; stored and used to generate the next questions.",
    )


@mcp.tool(
    name="conductor_next_questions",
    annotations={
        "title": "Get the next planning interview questions",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": False,
        "openWorldHint": False,
    },
)
async def conductor_next_questions(params: ConductorNextQuestionsInput, ctx: Context) -> dict[str, Any]:
    """Return next planning questions (with rationale) based on current job state."""
    store = ctx.request_context.lifespan_context.store
    if params.last_answers:
        await store.conductor_merge_answers(params.job_id, params.last_answers)
    job = await store.get_job(params.job_id)
    questions = compute_next_questions(job)
    return {
        "job_id": params.job_id,
        "questions": questions,
        "instructions": "Answer the questions, then call conductor_answer with an answers object.",
    }


class ConductorAnswerInput(JobIdInput):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    answers: dict[str, Any] = Field(..., description="Answers keyed by question key.")


@mcp.tool(
    name="conductor_answer",
    annotations={
        "title": "Submit answers during planning",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": False,
        "openWorldHint": False,
    },
)
async def conductor_answer(params: ConductorAnswerInput, ctx: Context) -> dict[str, Any]:
    """Store planning answers and return follow-up questions if any."""
    store = ctx.request_context.lifespan_context.store
    merged = await store.conductor_merge_answers(params.job_id, params.answers)

    # Convenience: if the caller included core planning artifacts, persist them directly.
    if isinstance(params.answers.get("deliverables"), list):
        await store.plan_set_deliverables(params.job_id, params.answers["deliverables"])
    if isinstance(params.answers.get("definition_of_done"), list):
        await store.plan_set_definition_of_done(params.job_id, params.answers["definition_of_done"])
    if isinstance(params.answers.get("invariants"), list):
        await store.plan_set_invariants(params.job_id, params.answers["invariants"])
    if isinstance(params.answers.get("steps"), list):
        steps = params.answers["steps"]
        if steps and isinstance(steps[0], dict):
            await store.plan_propose_steps(params.job_id, steps)

    job = await store.get_job(params.job_id)
    questions = compute_next_questions(job)
    return {"job_id": params.job_id, "answers": merged, "next_questions": questions}


class ContextAddBlockInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    job_id: str = Field(..., min_length=1)
    block_type: str = Field(..., min_length=1, description="e.g. REPO_MAP, RESEARCH, NOTE, FAILURE")
    content: str = Field(..., min_length=1)
    tags: list[str] = Field(default_factory=list)


@mcp.tool(
    name="context_add_block",
    annotations={
        "title": "Add a context block to job memory",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": False,
        "openWorldHint": False,
    },
)
async def context_add_block(params: ContextAddBlockInput, ctx: Context) -> dict[str, Any]:
    store = ctx.request_context.lifespan_context.store
    context_id = await store.context_add_block(
        job_id=params.job_id,
        block_type=params.block_type,
        content=params.content,
        tags=params.tags,
    )
    return {"context_id": context_id}


class ContextGetBlockInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    job_id: str = Field(..., min_length=1)
    context_id: str = Field(..., min_length=1)


@mcp.tool(
    name="context_get_block",
    annotations={
        "title": "Get a stored context block",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def context_get_block(params: ContextGetBlockInput, ctx: Context) -> dict[str, Any]:
    store = ctx.request_context.lifespan_context.store
    return await store.context_get_block(job_id=params.job_id, context_id=params.context_id)


class ContextSearchInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    job_id: str = Field(..., min_length=1)
    query: str = Field(..., min_length=1)
    limit: int = Field(default=20, ge=1, le=200)


@mcp.tool(
    name="context_search",
    annotations={
        "title": "Search stored context blocks",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def context_search(params: ContextSearchInput, ctx: Context) -> dict[str, Any]:
    store = ctx.request_context.lifespan_context.store
    results = await store.context_search(job_id=params.job_id, query=params.query, limit=params.limit)
    return {"count": len(results), "items": results}


class PlanSetDeliverablesInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    job_id: str = Field(..., min_length=1)
    deliverables: list[str] = Field(..., min_length=1)


@mcp.tool(
    name="plan_set_deliverables",
    annotations={
        "title": "Set job deliverables",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def plan_set_deliverables(params: PlanSetDeliverablesInput, ctx: Context) -> dict[str, Any]:
    store = ctx.request_context.lifespan_context.store
    await store.plan_set_deliverables(params.job_id, params.deliverables)
    return {"ok": True}


class PlanSetInvariantsInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    job_id: str = Field(..., min_length=1)
    invariants: list[str] = Field(..., description="Use [] to explicitly mean none.")


@mcp.tool(
    name="plan_set_invariants",
    annotations={
        "title": "Set job invariants",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def plan_set_invariants(params: PlanSetInvariantsInput, ctx: Context) -> dict[str, Any]:
    store = ctx.request_context.lifespan_context.store
    await store.plan_set_invariants(params.job_id, params.invariants)
    return {"ok": True}


class PlanSetDefinitionOfDoneInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    job_id: str = Field(..., min_length=1)
    definition_of_done: list[str] = Field(..., min_length=1)


@mcp.tool(
    name="plan_set_definition_of_done",
    annotations={
        "title": "Set job definition of done",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def plan_set_definition_of_done(params: PlanSetDefinitionOfDoneInput, ctx: Context) -> dict[str, Any]:
    store = ctx.request_context.lifespan_context.store
    await store.plan_set_definition_of_done(params.job_id, params.definition_of_done)
    return {"ok": True}


class StepSpec(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    step_id: str | None = Field(default=None, description="Optional; defaults to S1..Sn")
    title: str = Field(..., min_length=1)
    instruction_prompt: str = Field(..., min_length=1)
    expected_outputs: list[str] = Field(
        default_factory=list,
        description="What to produce within this step (files/commands/notes) to keep execution scoped.",
    )
    acceptance_criteria: list[str] = Field(default_factory=list)
    required_evidence: list[str] = Field(default_factory=list)
    gates: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Optional gate definitions (type/parameters/description).",
    )
    remediation_prompt: str = Field(default="", description="Prompt to repair if criteria not met")
    context_refs: list[str] = Field(default_factory=list)


class PlanProposeStepsInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    job_id: str = Field(..., min_length=1)
    steps: list[StepSpec] = Field(..., min_length=1)


@mcp.tool(
    name="plan_propose_steps",
    annotations={
        "title": "Propose/replace the ordered step list for a job",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def plan_propose_steps(params: PlanProposeStepsInput, ctx: Context) -> dict[str, Any]:
    store = ctx.request_context.lifespan_context.store
    normalized = await store.plan_propose_steps(
        params.job_id, [s.model_dump() for s in params.steps]
    )
    return {"ok": True, "steps": normalized}


@mcp.tool(
    name="job_set_ready",
    annotations={
        "title": "Transition a planned job to READY if minimum artifacts exist",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": False,
        "openWorldHint": False,
    },
)
async def job_set_ready(params: JobIdInput, ctx: Context) -> dict[str, Any]:
    store = ctx.request_context.lifespan_context.store
    return await store.job_set_ready(params.job_id)


@mcp.tool(
    name="job_start",
    annotations={
        "title": "Start execution for a READY job",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def job_start(params: JobIdInput, ctx: Context) -> dict[str, Any]:
    store = ctx.request_context.lifespan_context.store
    return await store.job_start(params.job_id)


class SubmitStepResultInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    job_id: str = Field(..., min_length=1)
    step_id: str = Field(..., min_length=1)
    model_claim: ModelClaim = Field(..., description="MET / NOT_MET / PARTIAL")
    summary: str = Field(..., min_length=1)
    evidence: dict[str, Any] = Field(default_factory=dict)
    devlog_line: str | None = Field(default=None)
    commit_hash: str | None = Field(default=None)


@mcp.tool(
    name="job_submit_step_result",
    annotations={
        "title": "Submit step result evidence and advance only if accepted",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": False,
        "openWorldHint": False,
    },
)
async def job_submit_step_result(params: SubmitStepResultInput, ctx: Context) -> dict[str, Any]:
    store = ctx.request_context.lifespan_context.store
    return await store.job_submit_step_result(
        job_id=params.job_id,
        step_id=params.step_id,
        model_claim=params.model_claim,
        summary=params.summary,
        evidence=params.evidence,
        devlog_line=params.devlog_line,
        commit_hash=params.commit_hash,
    )


class ApproveStepInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    job_id: str = Field(..., min_length=1)
    step_id: str = Field(..., min_length=1)


@mcp.tool(
    name="approve_step",
    annotations={
        "title": "Grant human approval for a step (for human_approval gates)",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def approve_step(params: ApproveStepInput, ctx: Context) -> dict[str, Any]:
    store = ctx.request_context.lifespan_context.store
    return await store.approve_step(
        job_id=params.job_id,
        step_id=params.step_id,
    )


class RevokeStepApprovalInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    job_id: str = Field(..., min_length=1)
    step_id: str = Field(..., min_length=1)


@mcp.tool(
    name="revoke_step_approval",
    annotations={
        "title": "Revoke human approval for a step",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def revoke_step_approval(params: RevokeStepApprovalInput, ctx: Context) -> dict[str, Any]:
    store = ctx.request_context.lifespan_context.store
    return await store.revoke_step_approval(
        job_id=params.job_id,
        step_id=params.step_id,
    )


class DevlogAppendInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    job_id: str = Field(..., min_length=1)
    content: str = Field(..., min_length=1)
    step_id: str | None = Field(default=None)
    commit_hash: str | None = Field(default=None)


@mcp.tool(
    name="devlog_append",
    annotations={
        "title": "Append a dev log entry",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": False,
        "openWorldHint": False,
    },
)
async def devlog_append(params: DevlogAppendInput, ctx: Context) -> dict[str, Any]:
    store = ctx.request_context.lifespan_context.store
    log_id = await store.devlog_append(
        job_id=params.job_id,
        content=params.content,
        step_id=params.step_id,
        commit_hash=params.commit_hash,
    )
    return {"log_id": log_id}


class MistakeRecordInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    job_id: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1)
    what_happened: str = Field(..., min_length=1)
    why: str = Field(..., min_length=1)
    lesson: str = Field(..., min_length=1)
    avoid_next_time: str = Field(..., min_length=1)
    tags: list[str] = Field(default_factory=list)
    related_step_id: str | None = Field(default=None)


@mcp.tool(
    name="mistake_record",
    annotations={
        "title": "Record a mistake entry (failure ledger)",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": False,
        "openWorldHint": False,
    },
)
async def mistake_record(params: MistakeRecordInput, ctx: Context) -> dict[str, Any]:
    store = ctx.request_context.lifespan_context.store
    mistake_id = await store.mistake_record(
        job_id=params.job_id,
        title=params.title,
        what_happened=params.what_happened,
        why=params.why,
        lesson=params.lesson,
        avoid_next_time=params.avoid_next_time,
        tags=params.tags,
        related_step_id=params.related_step_id,
    )
    return {"mistake_id": mistake_id}


class MistakeListInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    job_id: str = Field(..., min_length=1)
    limit: int = Field(default=50, ge=1, le=200)


@mcp.tool(
    name="mistake_list",
    annotations={
        "title": "List recorded mistakes",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def mistake_list(params: MistakeListInput, ctx: Context) -> dict[str, Any]:
    store = ctx.request_context.lifespan_context.store
    items = await store.mistake_list(job_id=params.job_id, limit=params.limit)
    return {"count": len(items), "items": items}


class RepoSnapshotInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    job_id: str = Field(..., min_length=1)
    repo_root: str = Field(..., min_length=1)
    notes: str | None = Field(default=None)


@mcp.tool(
    name="repo_snapshot",
    annotations={
        "title": "Take a repo snapshot (file tree + key files)",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": False,
        "openWorldHint": False,
    },
)
async def repo_snapshot(params: RepoSnapshotInput, ctx: Context) -> dict[str, Any]:
    store = ctx.request_context.lifespan_context.store
    return await store.repo_snapshot(job_id=params.job_id, repo_root=params.repo_root, notes=params.notes)


class RepoFileDescriptionsUpdateInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    job_id: str = Field(..., min_length=1)
    updates: dict[str, str] = Field(..., description="Mapping of repo-relative path -> one-line description")


@mcp.tool(
    name="repo_file_descriptions_update",
    annotations={
        "title": "Update repo map file descriptions",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def repo_file_descriptions_update(params: RepoFileDescriptionsUpdateInput, ctx: Context) -> dict[str, Any]:
    store = ctx.request_context.lifespan_context.store
    return await store.repo_file_descriptions_update(job_id=params.job_id, updates=params.updates)


class RepoMapExportInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    job_id: str = Field(..., min_length=1)
    format: str = Field(default="md", description="md | json")


@mcp.tool(
    name="repo_map_export",
    annotations={
        "title": "Export the repo map (markdown or json)",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def repo_map_export(params: RepoMapExportInput, ctx: Context) -> dict[str, Any]:
    store = ctx.request_context.lifespan_context.store
    return await store.repo_map_export(job_id=params.job_id, format=params.format)


class RepoFindStaleCandidatesInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    job_id: str = Field(..., min_length=1)
    max_results: int = Field(default=50, ge=1, le=200)


@mcp.tool(
    name="repo_find_stale_candidates",
    annotations={
        "title": "Find obvious stale/bloat candidates by heuristic filenames",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def repo_find_stale_candidates(params: RepoFindStaleCandidatesInput, ctx: Context) -> dict[str, Any]:
    store = ctx.request_context.lifespan_context.store
    return await store.repo_find_stale_candidates(job_id=params.job_id, max_results=params.max_results)


class JobExportBundleInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    job_id: str = Field(..., min_length=1)
    format: str = Field(default="json", description="json | md")


@mcp.tool(
    name="job_export_bundle",
    annotations={
        "title": "Export a job bundle (json or markdown)",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def job_export_bundle(params: JobExportBundleInput, ctx: Context) -> dict[str, Any]:
    store = ctx.request_context.lifespan_context.store
    return await store.job_export_bundle(job_id=params.job_id, format=params.format)


@mcp.tool(
    name="job_archive",
    annotations={
        "title": "Archive a job (soft delete)",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def job_archive(params: JobIdInput, ctx: Context) -> dict[str, Any]:
    store = ctx.request_context.lifespan_context.store
    await store.job_archive(job_id=params.job_id)
    return {"ok": True}


@mcp.tool(
    name="job_next_step_prompt",
    annotations={
        "title": "Get the current step prompt for an executing job",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def job_next_step_prompt(params: JobIdInput, ctx: Context) -> dict[str, Any]:
    """Return the next step prompt (instruction + evidence schema) for the job's current step."""
    store = ctx.request_context.lifespan_context.store
    return await store.job_next_step_prompt(params.job_id)


# =============================================================================
# UI State Tools
# =============================================================================


@mcp.tool(
    name="get_ui_state",
    annotations={
        "title": "Get complete UI state for a job",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def get_ui_state(params: JobIdInput, ctx: Context) -> dict[str, Any]:
    """
    Get complete UI state for rendering the VibeDev GUI.

    Returns a comprehensive bundle including:
    - Job metadata and status
    - Phase progress
    - All steps with status indicators
    - Current step details (if executing)
    - Recent mistakes and logs
    - Repo map and git status
    - Planning answers
    """
    store = ctx.request_context.lifespan_context.store
    return await store.get_ui_state(params.job_id)


# =============================================================================
# Job Lifecycle Tools
# =============================================================================


@mcp.tool(
    name="job_pause",
    annotations={
        "title": "Pause an executing job",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def job_pause(params: JobIdInput, ctx: Context) -> dict[str, Any]:
    """Pause a job that is currently executing. Can be resumed later."""
    store = ctx.request_context.lifespan_context.store
    return await store.job_pause(params.job_id)


@mcp.tool(
    name="job_resume",
    annotations={
        "title": "Resume a paused job",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def job_resume(params: JobIdInput, ctx: Context) -> dict[str, Any]:
    """Resume a paused job to continue execution."""
    store = ctx.request_context.lifespan_context.store
    return await store.job_resume(params.job_id)


class JobFailInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    job_id: str = Field(..., min_length=1)
    reason: str = Field(..., min_length=1, description="Reason for failure")


@mcp.tool(
    name="job_fail",
    annotations={
        "title": "Mark a job as failed",
        "readOnlyHint": False,
        "destructiveHint": True,
        "idempotentHint": False,
        "openWorldHint": False,
    },
)
async def job_fail(params: JobFailInput, ctx: Context) -> dict[str, Any]:
    """Mark a job as failed with a reason. This also records a mistake entry."""
    store = ctx.request_context.lifespan_context.store
    return await store.job_fail(params.job_id, params.reason)


class JobListInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    status: str | None = Field(
        default=None,
        description="Filter by status (PLANNING, READY, EXECUTING, PAUSED, COMPLETE, FAILED, ARCHIVED)",
    )
    limit: int = Field(default=50, ge=1, le=200)
    offset: int = Field(default=0, ge=0)


@mcp.tool(
    name="job_list",
    annotations={
        "title": "List all jobs with optional status filter",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def job_list(params: JobListInput, ctx: Context) -> dict[str, Any]:
    """List jobs with optional status filter, pagination support."""
    store = ctx.request_context.lifespan_context.store
    return await store.job_list(status=params.status, limit=params.limit, offset=params.offset)


# =============================================================================
# Plan Refinement Tools
# =============================================================================


class StepEditSpec(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    step_id: str = Field(..., min_length=1, description="Step ID to operate on")
    action: str = Field(
        default="update",
        description="Action: update, insert_before, insert_after, delete",
    )
    data: dict[str, Any] = Field(
        default_factory=dict,
        description="Step data for update/insert (title, instruction_prompt, etc.)",
    )


class PlanRefineStepsInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    job_id: str = Field(..., min_length=1)
    edits: list[StepEditSpec] = Field(..., min_length=1)


@mcp.tool(
    name="plan_refine_steps",
    annotations={
        "title": "Apply edits to existing steps without full replacement",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": False,
        "openWorldHint": False,
    },
)
async def plan_refine_steps(params: PlanRefineStepsInput, ctx: Context) -> dict[str, Any]:
    """
    Edit steps without replacing the entire list.

    Supports actions: update, insert_before, insert_after, delete.
    """
    store = ctx.request_context.lifespan_context.store
    edits = [e.model_dump() for e in params.edits]
    normalized = await store.plan_refine_steps(params.job_id, edits)
    return {"ok": True, "steps": normalized}


# =============================================================================
# Devlog Tools
# =============================================================================


class DevlogListInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    job_id: str = Field(..., min_length=1)
    log_type: str | None = Field(default=None, description="Filter by log type (DEVLOG, DECISION, etc.)")
    limit: int = Field(default=100, ge=1, le=1000)


@mcp.tool(
    name="devlog_list",
    annotations={
        "title": "List devlog entries for a job",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def devlog_list(params: DevlogListInput, ctx: Context) -> dict[str, Any]:
    """List devlog entries with optional type filter."""
    store = ctx.request_context.lifespan_context.store
    entries = await store.devlog_list(job_id=params.job_id, log_type=params.log_type, limit=params.limit)
    return {"count": len(entries), "entries": entries}


class DevlogExportInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    job_id: str = Field(..., min_length=1)
    format: str = Field(default="md", description="Export format: md or json")


@mcp.tool(
    name="devlog_export",
    annotations={
        "title": "Export devlog as markdown or JSON",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def devlog_export(params: DevlogExportInput, ctx: Context) -> dict[str, Any]:
    """Export all devlog entries for a job."""
    store = ctx.request_context.lifespan_context.store
    return await store.devlog_export(job_id=params.job_id, format=params.format)


# =============================================================================
# Git Integration Tools
# =============================================================================


@mcp.tool(
    name="git_status",
    annotations={
        "title": "Get git status for job's repository",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True,
    },
)
async def git_status(params: JobIdInput, ctx: Context) -> dict[str, Any]:
    """Get git working tree status for the job's repository."""
    store = ctx.request_context.lifespan_context.store
    return await store.git_status(job_id=params.job_id)


class GitDiffSummaryInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    job_id: str = Field(..., min_length=1)
    staged: bool = Field(default=False, description="Show staged changes only")


@mcp.tool(
    name="git_diff_summary",
    annotations={
        "title": "Get git diff summary for job's repository",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True,
    },
)
async def git_diff_summary(params: GitDiffSummaryInput, ctx: Context) -> dict[str, Any]:
    """Get git diff --stat summary for the job's repository."""
    store = ctx.request_context.lifespan_context.store
    return await store.git_diff_summary(job_id=params.job_id, staged=params.staged)


class GitLogInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    job_id: str = Field(..., min_length=1)
    n: int = Field(default=10, ge=1, le=100, description="Number of commits to show")


@mcp.tool(
    name="git_log",
    annotations={
        "title": "Get recent git commits for job's repository",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True,
    },
)
async def git_log(params: GitLogInput, ctx: Context) -> dict[str, Any]:
    """Get recent git commits (oneline format) for the job's repository."""     
    store = ctx.request_context.lifespan_context.store
    return await store.git_log(job_id=params.job_id, n=params.n)


# ============================================================================= 
# Templates Tools
# ============================================================================= 


@mcp.tool(
    name="template_list",
    annotations={
        "title": "List built-in workflow templates",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def template_list(ctx: Context) -> dict[str, Any]:
    templates = list_templates()
    return {"count": len(templates), "templates": templates}


class TemplateApplyInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    job_id: str = Field(..., min_length=1)
    template_id: str = Field(..., min_length=1)
    overwrite_planning_artifacts: bool = False
    overwrite_steps: bool = True


@mcp.tool(
    name="template_apply",
    annotations={
        "title": "Apply a built-in workflow template to a job (planning mode)",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": False,
        "openWorldHint": False,
    },
)
async def template_apply(params: TemplateApplyInput, ctx: Context) -> dict[str, Any]:
    store = ctx.request_context.lifespan_context.store
    template = get_template(params.template_id)

    await store.job_update_policies(
        job_id=params.job_id,
        update=template.get("recommended_policies") or {},
        merge=True,
    )

    job = await store.get_job(params.job_id)

    if params.overwrite_planning_artifacts or not job.get("deliverables"):
        await store.plan_set_deliverables(params.job_id, template.get("deliverables") or [])
    if params.overwrite_planning_artifacts or job.get("invariants") is None:
        await store.plan_set_invariants(params.job_id, template.get("invariants") or [])
    if params.overwrite_planning_artifacts or not job.get("definition_of_done"):
        await store.plan_set_definition_of_done(
            params.job_id, template.get("definition_of_done") or []
        )

    steps_out: list[dict[str, Any]] = []
    if params.overwrite_steps:
        await store.plan_propose_steps(params.job_id, template.get("steps") or [])
        steps_out = await store.get_steps(params.job_id)

    job = await store.get_job(params.job_id)
    return {"ok": True, "job": job, "steps": steps_out}


# ============================================================================= 
# Repo Hygiene Tools
# ============================================================================= 


class RepoHygieneSuggestInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    job_id: str = Field(..., min_length=1)
    max_suggestions: int = Field(default=20, ge=1, le=100)


@mcp.tool(
    name="repo_hygiene_suggest",
    annotations={
        "title": "Suggest repo hygiene improvements",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True,
    },
)
async def repo_hygiene_suggest(params: RepoHygieneSuggestInput, ctx: Context) -> dict[str, Any]:
    """
    Analyze the repository and suggest hygiene improvements.

    Returns suggestions for stale files, undescribed files, etc.
    """
    store = ctx.request_context.lifespan_context.store
    return await store.repo_hygiene_suggest(job_id=params.job_id, max_suggestions=params.max_suggestions)


def _openapi_main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(prog="vibedev-mcp openapi")
    parser.add_argument(
        "--out",
        help="Write OpenAPI JSON to this file (defaults to stdout).",
    )
    args = parser.parse_args(argv)

    from pathlib import Path

    from vibedev_mcp.http_server import create_app

    app = create_app()
    payload = app.openapi()
    text = json.dumps(payload, indent=2, sort_keys=True)

    if args.out:
        Path(args.out).write_text(text + "\n", encoding="utf-8")
        return 0

    sys.stdout.write(text + "\n")
    return 0


def main() -> None:
    argv = sys.argv[1:]
    if argv and argv[0] == "serve":
        from vibedev_mcp.http_server import serve_main

        serve_main(argv[1:])
        return

    if argv and argv[0] == "openapi":
        raise SystemExit(_openapi_main(argv[1:]))

    mcp.run()


if __name__ == "__main__":
    main()
