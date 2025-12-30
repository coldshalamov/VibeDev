from __future__ import annotations

from typing import Any


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

    # Phase 1: Intent & Scope (store answers in planning_answers)
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
    if phase1_required_missing:
        return phase1_required_missing + phase1_optional_missing

    # Phase 2: Deliverables (job fields)
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
    if phase2_missing:
        return phase2_missing

    # Phase 3: Invariants (job fields)
    if job.get("invariants") is None:
        return [
            q(
                3,
                "invariants",
                "List invariants (non-negotiable rules). If none, explicitly say [].",
                "Invariants are injected into every execution step to prevent drift.",
                ["invariants"],
            )
        ]

    # Phase 4: Repo context (job fields + planning answers)
    repo_exists = bool(planning.get("repo_exists"))
    if repo_exists:
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
        if phase4_missing:
            return phase4_missing

    # Phase 5: Plan compilation (steps)
    if not job.get("step_order"):
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
