from __future__ import annotations

from typing import Any


def list_templates() -> list[dict[str, Any]]:
    return [
        {
            "template_id": "strict_feature",
            "title": "Strict feature pipeline",
            "description": (
                "A best-practice, evidence-first workflow that emphasizes small diffs, "
                "repeatable verification, and CI-style gates (tests/build) as part of execution."
            ),
        }
    ]


CHECKPOINT_STEP_TEMPLATE = {
    "title": "Checkpoint: Verify Code & Regressions",
    "instruction_prompt": (
        "Run the full test suite to ensure no regressions were introduced. "
        "If any tests fail, fix them before proceeding. "
        "Also verify that the recent changes align with the goal."
    ),
    "acceptance_criteria": [
        "All tests pass (no regressions)",
        "Recent changes verified correct",
    ],
    "required_evidence": ["tests_run", "tests_passed", "commands_run"],
    "gates": [
        {
            "type": "command_exit_0",
            "parameters": {"command": "python -m pytest", "timeout": 600},
            "description": "Full regression suite must pass.",
        }
    ],
}


def get_template(template_id: str) -> dict[str, Any]:
    if template_id != "strict_feature":
        raise KeyError(f"Unknown template_id: {template_id}")

    # NOTE: This is intentionally generic. Users should edit the step prompts
    # to match their repo; the gate choices are the “guardrails”.
    return {
        "template_id": "strict_feature",
        "title": "Strict feature pipeline",
        "description": "Opinionated, evidence-first feature workflow with enforceable gates.",
        "recommended_policies": {
            "evidence_schema_mode": "strict",
            "require_tests_evidence": True,
            "require_diff_summary": True,
            # Safety: shell-executing gates are enabled for this template, but commands are allowlisted.
            "enable_shell_gates": True,
            "shell_gate_allowlist": [
                "*python* -m pytest*",
                "*pytest*",
                "*npm run build*",
                "*npm run lint*",
            ],
            # Keep retries bounded; prefer pausing for human after exhaustion.
            "max_retries_per_step": 2,
            "retry_exhausted_action": "PAUSE_FOR_HUMAN",
        },
        "deliverables": [
            "Working feature implemented",
            "Automated tests added/updated",
            "Clean, reviewable diff",
        ],
        "invariants": [
            "Keep diffs small and scoped (no opportunistic refactors).",
            "No claims without evidence: run tests/build commands and paste outputs when requested.",
            "If unsure, stop and route back to planning instead of guessing.",
        ],
        "definition_of_done": [
            "All tests pass",
            "No policy/gate violations (diff bounds, allowlists, etc.)",
            "Devlog updated with what changed + why",
        ],
        "steps": [
            {
                "title": "Repo recon + baseline check",
                "instruction_prompt": (
                    "Confirm entrypoints, test commands, and current status. "
                    "Run the baseline test command. Record outputs as evidence."
                ),
                "acceptance_criteria": [
                    "Entrypoints identified",
                    "Baseline tests pass",
                ],
                "required_evidence": ["commands_run", "tests_run", "tests_passed", "criteria_checklist"],
                "gates": [
                    {"type": "diff_max_lines", "parameters": {"max": 50}, "description": "No big changes in recon step."},
                    {
                        "type": "command_exit_0",
                        "parameters": {"command": "python -m pytest -q", "timeout": 300},
                        "description": "Baseline tests must pass.",
                    },
                ],
            },
            {
                "title": "Implement change (small diff) + prove it",
                "instruction_prompt": (
                    "Implement the minimal change needed for the goal and add/adjust tests. "
                    "Keep the diff small; do not change unrelated files."
                ),
                "acceptance_criteria": [
                    "Change implemented",
                    "Tests cover change and pass",
                ],
                "required_evidence": [
                    "changed_files",
                    "diff_summary",
                    "commands_run",
                    "tests_run",
                    "tests_passed",
                    "criteria_checklist",
                ],
                "gates": [
                    {"type": "diff_max_lines", "parameters": {"max": 400}, "description": "Keep diffs reviewable."},
                    {
                        "type": "command_exit_0",
                        "parameters": {"command": "python -m pytest -q", "timeout": 300},
                        "description": "Tests must pass.",
                    },
                ],
            },
        ],
    }

