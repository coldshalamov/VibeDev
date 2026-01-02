"""VibeDev planning conductor logic.

This module implements the phased planning interview that guides the user
through collecting all required artifacts before a job can be marked READY.

Planning Phases:
1. Intent & Scope - repo_exists, out_of_scope, target_environment, timeline_priority
2. Deliverables - deliverables, definition_of_done, tests_expected
3. Invariants - invariants (non-negotiable rules)
4. Repo Context - repo_root, key_files, entrypoints (only if repo_exists)
5. Plan Compilation - steps (ordered list with criteria + evidence)
"""

from __future__ import annotations

from enum import IntEnum
from typing import Any


class PlanningPhase(IntEnum):
    """Planning interview phases."""

    INTENT_SCOPE = 1
    DELIVERABLES = 2
    INVARIANTS = 3
    REPO_CONTEXT = 4
    PLAN_COMPILATION = 5
    COMPLETE = 6


# Phase 1 required keys (in planning_answers)
PHASE1_REQUIRED = {"repo_exists", "out_of_scope", "target_environment", "timeline_priority"}
PHASE1_OPTIONAL = {"user_constraints"}

# Phase 2 required keys (in job fields or planning_answers)
PHASE2_REQUIRED = {"deliverables", "definition_of_done"}
PHASE2_OPTIONAL = {"tests_expected"}

# Phase 3 required keys (in job fields)
PHASE3_REQUIRED = {"invariants"}

# Phase 4 required keys (conditional on repo_exists)
PHASE4_REQUIRED_IF_REPO = {"repo_root"}
PHASE4_OPTIONAL = {"key_files", "entrypoints"}

# Phase 5 required keys
PHASE5_REQUIRED = {"steps"}


def get_current_phase(job: dict[str, Any]) -> PlanningPhase:
    """Determine the current planning phase based on job state."""
    planning = job.get("planning_answers") or {}

    def has_planning_key(key: str) -> bool:
        return key in planning and planning[key] is not None

    def has_job_field(key: str) -> bool:
        value = job.get(key)
        if value is None:
            return False
        if isinstance(value, list):
            return len(value) > 0
        return True

    # Check Phase 1
    phase1_complete = all(has_planning_key(k) for k in PHASE1_REQUIRED)
    if not phase1_complete:
        return PlanningPhase.INTENT_SCOPE

    # Check Phase 2
    phase2_complete = (
        has_job_field("deliverables") and has_job_field("definition_of_done")
    )
    if not phase2_complete:
        return PlanningPhase.DELIVERABLES

    # Check Phase 3
    phase3_complete = job.get("invariants") is not None  # Can be empty list
    if not phase3_complete:
        return PlanningPhase.INVARIANTS

    # Check Phase 4 (only if repo exists)
    repo_exists = bool(planning.get("repo_exists"))
    if repo_exists:
        phase4_complete = job.get("repo_root") is not None
        if not phase4_complete:
            return PlanningPhase.REPO_CONTEXT

    # Check Phase 5
    phase5_complete = bool(job.get("step_order"))
    if not phase5_complete:
        return PlanningPhase.PLAN_COMPILATION

    return PlanningPhase.COMPLETE


def compute_next_questions(job: dict[str, Any]) -> list[dict[str, Any]]:
    """
    Compute the next planning interview questions based on missing job artifacts.

    Returns a list of dicts:
      {
        "phase": int,
        "key": str,
        "question": str,
        "rationale": str,
        "required_fields": list[str],
        "required": bool
      }
    """
    planning = job.get("planning_answers") or {}
    current_phase = get_current_phase(job)

    if current_phase == PlanningPhase.COMPLETE:
        return []

    def has_planning_key(key: str) -> bool:
        return key in planning and planning[key] is not None

    def q(
        phase: int,
        key: str,
        question: str,
        rationale: str,
        required_fields: list[str],
        *,
        required: bool = True,
    ) -> dict[str, Any]:
        return {
            "phase": phase,
            "key": key,
            "question": question,
            "rationale": rationale,
            "required_fields": required_fields,
            "required": required,
        }

    # Phase 1: Intent & Scope
    if current_phase == PlanningPhase.INTENT_SCOPE:
        phase1_required_missing: list[dict[str, Any]] = []
        phase1_optional_missing: list[dict[str, Any]] = []

        if not has_planning_key("repo_exists"):
            phase1_required_missing.append(
                q(
                    1,
                    "repo_exists",
                    "Does a repo already exist for this job? (true/false).",
                    "Repo context questions differ for existing vs greenfield projects.",
                    ["repo_exists"],
                )
            )
        if not has_planning_key("out_of_scope"):
            phase1_required_missing.append(
                q(
                    1,
                    "out_of_scope",
                    "What is explicitly out of scope? (bullets).",
                    "Guardrails reduce accidental scope creep during execution.",
                    ["out_of_scope"],
                )
            )
        if not has_planning_key("target_environment"):
            phase1_required_missing.append(
                q(
                    1,
                    "target_environment",
                    "What is the target environment? Include OS, runtime/language, and any constraints.",
                    "The plan and tooling should match the real runtime environment.",
                    ["target_environment"],
                )
            )
        if not has_planning_key("timeline_priority"):
            phase1_required_missing.append(
                q(
                    1,
                    "timeline_priority",
                    "What is the priority/timeline? (e.g. MVP, robust, quick prototype).",
                    "This affects trade-offs (testing depth, refactors, optional features).",
                    ["timeline_priority"],
                )
            )
        if not has_planning_key("user_constraints"):
            phase1_optional_missing.append(
                q(
                    1,
                    "user_constraints",
                    "Any constraints about your ability or preferences? (e.g. 'I need guardrails', 'no new deps').",
                    "The conductor should adapt strictness and defaults to the user's constraints.",
                    ["user_constraints"],
                    required=False,
                )
            )

        return phase1_required_missing + phase1_optional_missing

    # Phase 2: Deliverables
    if current_phase == PlanningPhase.DELIVERABLES:
        phase2_missing: list[dict[str, Any]] = []

        if not job.get("deliverables"):
            phase2_missing.append(
                q(
                    2,
                    "deliverables",
                    "List the exact deliverables (bullets): files, commands/tools, docs, scripts, etc.",
                    "Execution gating needs concrete outputs to verify progress.",
                    ["deliverables"],
                )
            )
        if not job.get("definition_of_done"):
            phase2_missing.append(
                q(
                    2,
                    "definition_of_done",
                    "Define 'done' as a checklist (tests, docs, verification, acceptance).",
                    "The job can't transition to READY without an explicit DoD.",
                    ["definition_of_done"],
                )
            )
        if not has_planning_key("tests_expected"):
            phase2_missing.append(
                q(
                    2,
                    "tests_expected",
                    "What tests are expected? (unit/integration/smoke, exact commands if known).",
                    "Clear test expectations prevent shallow 'looks good' completions.",
                    ["tests_expected"],
                    required=False,
                )
            )

        return phase2_missing

    # Phase 3: Invariants
    if current_phase == PlanningPhase.INVARIANTS:
        return [
            q(
                3,
                "invariants",
                "List invariants (non-negotiable rules). If none, explicitly say [].",
                "Invariants are injected into every execution step to prevent drift.",
                ["invariants"],
            )
        ]

    # Phase 4: Repo Context
    if current_phase == PlanningPhase.REPO_CONTEXT:
        phase4_missing: list[dict[str, Any]] = []

        if job.get("repo_root") is None:
            phase4_missing.append(
                q(
                    4,
                    "repo_root",
                    "What is the repo root path for this job (absolute path)?",
                    "Repo snapshots and hygiene tooling need a root directory.",
                    ["repo_root"],
                )
            )
        if not has_planning_key("key_files"):
            phase4_missing.append(
                q(
                    4,
                    "key_files",
                    "List key files and entrypoints (or say 'unknown').",
                    "A repo map reduces search thrash and improves step scoping.",
                    ["key_files"],
                    required=False,
                )
            )
        if not has_planning_key("entrypoints"):
            phase4_missing.append(
                q(
                    4,
                    "entrypoints",
                    "List known modules/entrypoints (or say 'unknown').",
                    "Entrypoints help focus step planning and avoid wandering edits.",
                    ["entrypoints"],
                    required=False,
                )
            )

        return phase4_missing

    # Phase 5: Plan Compilation
    if current_phase == PlanningPhase.PLAN_COMPILATION:
        return [
            q(
                5,
                "steps",
                "Propose an ordered list of small, verifiable steps (each with criteria + required evidence).",
                "Execution mode drip-feeds one step at a time; steps must be atomic and evidenced.",
                ["steps"],
            )
        ]

    return []


def validate_ready_transition(job: dict[str, Any]) -> tuple[bool, list[str]]:
    """
    Validate whether a job can transition to READY status.

    Returns (is_ready, missing_fields).
    """
    missing: list[str] = []

    # Check all phases are complete
    current_phase = get_current_phase(job)
    if current_phase != PlanningPhase.COMPLETE:
        # Get missing fields based on phase
        if current_phase == PlanningPhase.INTENT_SCOPE:
            missing.append("phase1_incomplete")
        elif current_phase == PlanningPhase.DELIVERABLES:
            if not job.get("deliverables"):
                missing.append("deliverables")
            if not job.get("definition_of_done"):
                missing.append("definition_of_done")
        elif current_phase == PlanningPhase.INVARIANTS:
            missing.append("invariants")
        elif current_phase == PlanningPhase.REPO_CONTEXT:
            missing.append("repo_root")
        elif current_phase == PlanningPhase.PLAN_COMPILATION:
            missing.append("steps")

    # Additional validations
    if not job.get("deliverables"):
        if "deliverables" not in missing:
            missing.append("deliverables")

    if job.get("invariants") is None:
        if "invariants" not in missing:
            missing.append("invariants")

    if not job.get("definition_of_done"):
        if "definition_of_done" not in missing:
            missing.append("definition_of_done")

    if not job.get("step_order"):
        if "steps" not in missing:
            missing.append("steps")

    return len(missing) == 0, missing


def get_phase_summary(job: dict[str, Any]) -> dict[str, Any]:
    """Get a summary of planning phase progress."""
    current_phase = get_current_phase(job)
    planning = job.get("planning_answers") or {}

    phase_status = {}
    for phase in PlanningPhase:
        if phase == PlanningPhase.COMPLETE:
            continue
        phase_status[phase.name] = {
            "phase": phase.value,
            "complete": phase.value < current_phase.value,
            "current": phase.value == current_phase.value,
        }

    return {
        "current_phase": current_phase.value,
        "current_phase_name": current_phase.name,
        "is_complete": current_phase == PlanningPhase.COMPLETE,
        "phases": phase_status,
        "has_repo": bool(planning.get("repo_exists")),
        "step_count": len(job.get("step_order", [])),
    }
