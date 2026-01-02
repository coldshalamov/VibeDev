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
        },
        {
            "template_id": "tdd_loop",
            "title": "TDD Loop",
            "description": (
                "Test-Driven Development cycle: write failing test, implement minimal code, "
                "refactor. Tight iteration with automated verification at each step."
            ),
        },
        {
            "template_id": "react_component",
            "title": "React Component Generator",
            "description": (
                "Generate a React component with accessibility, TypeScript types, and "
                "design system compliance. Includes build verification gates."
            ),
        },
        {
            "template_id": "bug_fix",
            "title": "Bug Fix Flow",
            "description": (
                "Structured bug investigation: reproduce, root cause analysis, fix, "
                "regression test. Ensures the bug is truly fixed and won't recur."
            ),
        },
        {
            "template_id": "context_fetcher",
            "title": "Context Fetcher",
            "description": (
                "Gather repository context before making changes. Identifies entrypoints, "
                "dependencies, and constraints. Useful as a first step in larger workflows."
            ),
        },
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
    templates = _get_all_templates()
    if template_id not in templates:
        raise KeyError(f"Unknown template_id: {template_id}")
    return templates[template_id]


def _get_all_templates() -> dict[str, dict[str, Any]]:
    """Internal registry of all available templates."""
    return {
        "strict_feature": _strict_feature_template(),
        "tdd_loop": _tdd_loop_template(),
        "react_component": _react_component_template(),
        "bug_fix": _bug_fix_template(),
        "context_fetcher": _context_fetcher_template(),
    }


def _strict_feature_template() -> dict[str, Any]:
    """Opinionated, evidence-first feature workflow with enforceable gates."""
    return {
        "template_id": "strict_feature",
        "title": "Strict feature pipeline",
        "description": "Opinionated, evidence-first feature workflow with enforceable gates.",
        "recommended_policies": {
            "evidence_schema_mode": "strict",
            "require_tests_evidence": True,
            "require_diff_summary": True,
            "enable_shell_gates": True,
            "shell_gate_allowlist": [
                "*python* -m pytest*",
                "*pytest*",
                "*npm run build*",
                "*npm run lint*",
            ],
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


def _tdd_loop_template() -> dict[str, Any]:
    """Test-Driven Development cycle: red → green → refactor."""
    return {
        "template_id": "tdd_loop",
        "title": "TDD Loop",
        "description": "Test-Driven Development cycle: write failing test, implement minimal code, refactor.",
        "recommended_policies": {
            "evidence_schema_mode": "strict",
            "require_tests_evidence": True,
            "enable_shell_gates": True,
            "shell_gate_allowlist": ["*pytest*", "*npm test*", "*npm run test*"],
            "max_retries_per_step": 3,
            "retry_exhausted_action": "PAUSE_FOR_HUMAN",
        },
        "deliverables": [
            "Failing test written first",
            "Minimal implementation to pass test",
            "Clean, refactored code",
        ],
        "invariants": [
            "Never write implementation before the test.",
            "Each iteration must be small and focused.",
            "Refactoring must not change behavior (tests stay green).",
        ],
        "definition_of_done": [
            "All tests pass",
            "Code is clean and readable",
            "No unused code introduced",
        ],
        "steps": [
            {
                "title": "Write the failing test (RED)",
                "instruction_prompt": (
                    "Write a minimal failing test that captures the required behavior. "
                    "Run it and confirm it fails for the expected reason. Do NOT implement any production code yet."
                ),
                "acceptance_criteria": [
                    "Test written",
                    "Test fails for the expected reason",
                ],
                "required_evidence": ["tests_run", "test_output", "changed_files"],
                "gates": [
                    {"type": "tests_passed", "parameters": {"expected": False}, "description": "Test must fail initially."},
                    {"type": "diff_max_lines", "parameters": {"max": 100}, "description": "Keep test additions small."},
                ],
            },
            {
                "title": "Implement minimal code (GREEN)",
                "instruction_prompt": (
                    "Implement the minimal code needed to make the test pass. "
                    "Avoid over-engineering. Do not change unrelated files."
                ),
                "acceptance_criteria": [
                    "Test now passes",
                    "No unrelated changes",
                ],
                "required_evidence": ["tests_run", "tests_passed", "changed_files", "diff_summary"],
                "gates": [
                    {
                        "type": "command_exit_0",
                        "parameters": {"command": "python -m pytest -q", "timeout": 300},
                        "description": "Tests must pass.",
                    },
                    {"type": "diff_max_lines", "parameters": {"max": 200}, "description": "Keep implementation minimal."},
                ],
            },
            {
                "title": "Refactor (optional)",
                "instruction_prompt": (
                    "Refactor the code for clarity, readability, or performance. "
                    "Re-run tests and ensure everything stays green. Skip if no refactoring needed."
                ),
                "acceptance_criteria": [
                    "All tests still pass",
                    "Code quality improved or unchanged",
                ],
                "required_evidence": ["tests_run", "tests_passed"],
                "gates": [
                    {
                        "type": "command_exit_0",
                        "parameters": {"command": "python -m pytest -q", "timeout": 300},
                        "description": "Tests must still pass after refactoring.",
                    },
                ],
            },
        ],
    }


def _react_component_template() -> dict[str, Any]:
    """Generate a React component with verification gates."""
    return {
        "template_id": "react_component",
        "title": "React Component Generator",
        "description": "Generate a React component with accessibility, TypeScript, and design system compliance.",
        "recommended_policies": {
            "evidence_schema_mode": "strict",
            "require_diff_summary": True,
            "enable_shell_gates": True,
            "shell_gate_allowlist": ["*npm run build*", "*npm run lint*", "*tsc*", "*npx tsc*"],
            "max_retries_per_step": 2,
            "retry_exhausted_action": "PAUSE_FOR_HUMAN",
        },
        "deliverables": [
            "React component file created",
            "TypeScript types defined",
            "Accessible and design-system compliant",
        ],
        "invariants": [
            "Use existing design tokens and components from the design system.",
            "All props must be typed.",
            "Include aria-labels for accessibility.",
        ],
        "definition_of_done": [
            "Build passes (no TypeScript errors)",
            "Lint passes",
            "Component renders without errors",
        ],
        "steps": [
            {
                "title": "Create component skeleton",
                "instruction_prompt": (
                    "Create the component file with proper TypeScript types, props interface, "
                    "and basic JSX structure. Use existing design system imports."
                ),
                "acceptance_criteria": [
                    "Component file exists",
                    "Props are typed",
                    "Imports design system correctly",
                ],
                "required_evidence": ["changed_files", "diff_summary"],
                "gates": [
                    {"type": "file_exists", "parameters": {"path_pattern": "*.tsx"}, "description": "Component file must exist."},
                ],
            },
            {
                "title": "Implement component logic",
                "instruction_prompt": (
                    "Implement the component's behavior, state management, and event handlers. "
                    "Ensure accessibility attributes are in place."
                ),
                "acceptance_criteria": [
                    "Component logic implemented",
                    "Accessibility attributes added",
                ],
                "required_evidence": ["changed_files", "diff_summary", "commands_run"],
                "gates": [
                    {
                        "type": "command_exit_0",
                        "parameters": {"command": "npm run build", "timeout": 120},
                        "description": "Build must pass.",
                    },
                ],
            },
            {
                "title": "Verify and lint",
                "instruction_prompt": (
                    "Run the linter and fix any issues. Verify the component renders correctly. "
                    "Take a screenshot or describe the visual output as evidence."
                ),
                "acceptance_criteria": [
                    "Lint passes",
                    "Component renders correctly",
                ],
                "required_evidence": ["commands_run", "lint_output"],
                "gates": [
                    {
                        "type": "command_exit_0",
                        "parameters": {"command": "npm run lint", "timeout": 60},
                        "description": "Lint must pass.",
                    },
                ],
            },
        ],
    }


def _bug_fix_template() -> dict[str, Any]:
    """Structured bug investigation and fix workflow."""
    return {
        "template_id": "bug_fix",
        "title": "Bug Fix Flow",
        "description": "Structured bug investigation: reproduce, root cause analysis, fix, regression test.",
        "recommended_policies": {
            "evidence_schema_mode": "strict",
            "require_tests_evidence": True,
            "require_diff_summary": True,
            "enable_shell_gates": True,
            "shell_gate_allowlist": ["*pytest*", "*npm test*"],
            "max_retries_per_step": 2,
            "retry_exhausted_action": "PAUSE_FOR_HUMAN",
        },
        "deliverables": [
            "Bug reproduced with a failing test",
            "Root cause identified",
            "Fix implemented",
            "Regression test added",
        ],
        "invariants": [
            "The bug must be reproducible before attempting a fix.",
            "A regression test must be added to prevent recurrence.",
            "Do not fix unrelated issues in the same change.",
        ],
        "definition_of_done": [
            "All tests pass (including new regression test)",
            "Bug no longer reproducible",
            "Root cause documented",
        ],
        "steps": [
            {
                "title": "Reproduce the bug",
                "instruction_prompt": (
                    "Write a failing test that reproduces the bug. Run it and confirm it fails "
                    "in a way that matches the reported behavior. Document the reproduction steps."
                ),
                "acceptance_criteria": [
                    "Bug reproduced",
                    "Failing test written",
                ],
                "required_evidence": ["tests_run", "test_output", "reproduction_steps"],
                "gates": [
                    {"type": "tests_passed", "parameters": {"expected": False}, "description": "Reproduction test must fail."},
                ],
            },
            {
                "title": "Root cause analysis",
                "instruction_prompt": (
                    "Investigate the codebase to identify the root cause of the bug. "
                    "Document your findings, including the faulty code and why it fails."
                ),
                "acceptance_criteria": [
                    "Root cause identified",
                    "Analysis documented",
                ],
                "required_evidence": ["root_cause_analysis", "faulty_code_location"],
                "gates": [],
            },
            {
                "title": "Implement the fix",
                "instruction_prompt": (
                    "Fix the root cause. The reproduction test should now pass. "
                    "Ensure no regressions in other tests."
                ),
                "acceptance_criteria": [
                    "Fix implemented",
                    "Reproduction test passes",
                    "All other tests pass",
                ],
                "required_evidence": ["changed_files", "diff_summary", "tests_run", "tests_passed"],
                "gates": [
                    {
                        "type": "command_exit_0",
                        "parameters": {"command": "python -m pytest -q", "timeout": 300},
                        "description": "All tests must pass.",
                    },
                    {"type": "diff_max_lines", "parameters": {"max": 300}, "description": "Keep fix focused."},
                ],
            },
        ],
    }


def _context_fetcher_template() -> dict[str, Any]:
    """Gather repository context before making changes."""
    return {
        "template_id": "context_fetcher",
        "title": "Context Fetcher",
        "description": "Gather repository context before making changes. Identifies entrypoints, dependencies, and constraints.",
        "recommended_policies": {
            "evidence_schema_mode": "lenient",
            "require_tests_evidence": False,
            "require_diff_summary": False,
            "enable_shell_gates": False,
            "max_retries_per_step": 1,
            "retry_exhausted_action": "CONTINUE",
        },
        "deliverables": [
            "Entrypoints identified",
            "Key dependencies listed",
            "Constraints and risks documented",
        ],
        "invariants": [
            "Do not make any code changes in this phase.",
            "Document findings thoroughly.",
        ],
        "definition_of_done": [
            "Entrypoints documented",
            "Dependencies analyzed",
            "Risks identified",
        ],
        "steps": [
            {
                "title": "Identify entrypoints",
                "instruction_prompt": (
                    "Scan the repository to find main entrypoints (e.g., main.py, index.ts, App.tsx). "
                    "List them with a brief description of their purpose."
                ),
                "acceptance_criteria": [
                    "Entrypoints listed",
                    "Purpose described",
                ],
                "required_evidence": ["entrypoints_list", "notes"],
                "gates": [
                    {"type": "diff_max_lines", "parameters": {"max": 0}, "description": "No code changes allowed."},
                ],
            },
            {
                "title": "Analyze dependencies",
                "instruction_prompt": (
                    "Identify key dependencies from package.json, pyproject.toml, or equivalent. "
                    "Note any outdated or risky dependencies."
                ),
                "acceptance_criteria": [
                    "Dependencies listed",
                    "Version risks noted",
                ],
                "required_evidence": ["dependencies_list", "notes"],
                "gates": [
                    {"type": "diff_max_lines", "parameters": {"max": 0}, "description": "No code changes allowed."},
                ],
            },
            {
                "title": "Document constraints and risks",
                "instruction_prompt": (
                    "Based on your recon, document any constraints, architectural decisions, "
                    "or risks that should inform the implementation plan."
                ),
                "acceptance_criteria": [
                    "Constraints documented",
                    "Risks identified",
                ],
                "required_evidence": ["constraints", "risks", "notes"],
                "gates": [],
            },
        ],
    }
