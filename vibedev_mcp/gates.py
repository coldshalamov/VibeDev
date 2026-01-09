"""Shell gate execution module for VibeDev.

This module provides safe, policy-controlled execution of shell commands
for gate validation (e.g., running tests, linters, builds).
"""

from __future__ import annotations

import asyncio
import fnmatch
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass
class GateResult:
    """Result of a gate evaluation."""

    passed: bool
    gate_type: str
    description: str
    details: str | None = None
    output: str | None = None
    exit_code: int | None = None

    def to_dict(self) -> dict[str, Any]:
        d = {
            "passed": self.passed,
            "gate_type": self.gate_type,
            "description": self.description,
        }
        if self.details:
            d["details"] = self.details
        if self.output:
            d["output"] = self.output[:2000]  # Truncate long output
        if self.exit_code is not None:
            d["exit_code"] = self.exit_code
        return d


def command_matches_allowlist(command: str, allowlist: list[str]) -> bool:
    """
    Check if a command matches any pattern in the allowlist.

    Patterns support wildcards:
    - *pytest* matches any command containing 'pytest'
    - *npm run build* matches 'npm run build'
    """
    command_lower = command.lower().strip()

    for pattern in allowlist:
        pattern_lower = pattern.lower().strip()
        # Use fnmatch for glob-style matching
        if fnmatch.fnmatch(command_lower, pattern_lower):
            return True
        # Also check if pattern appears as substring (for convenience)
        if "*" in pattern_lower:
            # Extract the non-wildcard part
            core = pattern_lower.replace("*", "")
            if core and core in command_lower:
                return True

    return False


async def execute_shell_gate(
    command: str,
    *,
    cwd: str | None = None,
    timeout: int = 60,
    env: dict[str, str] | None = None,
) -> tuple[bool, str, int]:
    """
    Execute a shell command and return (success, output, exit_code).

    Args:
        command: The shell command to execute
        cwd: Working directory (defaults to current directory)
        timeout: Max seconds to wait for command
        env: Optional environment variables to add

    Returns:
        Tuple of (passed, output, exit_code)
    """
    # Build environment
    run_env = os.environ.copy()
    if env:
        run_env.update(env)

    # Determine shell based on platform
    args = command

    try:
        # Run the command
        proc = await asyncio.create_subprocess_shell(
            args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            cwd=cwd,
            env=run_env,
        )

        try:
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=timeout)
            output = stdout.decode("utf-8", errors="replace") if stdout else ""
            exit_code = proc.returncode or 0
            passed = exit_code == 0
        except asyncio.TimeoutError:
            proc.kill()
            await proc.wait()
            return False, f"Command timed out after {timeout} seconds", -1

    except Exception as e:
        return False, f"Failed to execute command: {e}", -1

    return passed, output, exit_code


async def evaluate_gate(
    gate: dict[str, Any],
    *,
    evidence: dict[str, Any],
    repo_root: str | None = None,
    policies: dict[str, Any] | None = None,
    changed_files: list[str] | None = None,
) -> GateResult:
    """
    Evaluate a single gate.

    Args:
        gate: Gate definition with 'type', 'parameters', 'description'
        evidence: The evidence dict submitted by the model
        repo_root: Path to the repository root
        policies: Job policies controlling gate behavior
        changed_files: List of files changed in this step

    Returns:
        GateResult indicating pass/fail and details
    """
    policies = policies or {}
    gate_type = gate.get("type", "unknown")
    description = gate.get("description", f"Gate: {gate_type}")
    params = gate.get("parameters", {})

    # -------------------------------------------------------------------------
    # Evidence-based gates (no shell execution)
    # -------------------------------------------------------------------------

    if gate_type == "tests_passed":
        expected = params.get("expected", True)
        actual = evidence.get("tests_passed")
        if actual is None:
            return GateResult(False, gate_type, description, "tests_passed not in evidence")
        passed = actual == expected
        return GateResult(
            passed,
            gate_type,
            description,
            f"Expected tests_passed={expected}, got {actual}",
        )

    if gate_type == "lint_passed":
        actual = evidence.get("lint_passed")
        if actual is None:
            return GateResult(False, gate_type, description, "lint_passed not in evidence")
        return GateResult(actual is True, gate_type, description)

    if gate_type == "criteria_checklist_complete":
        checklist = evidence.get("criteria_checklist", {})
        if not isinstance(checklist, dict):
            return GateResult(False, gate_type, description, "criteria_checklist is not a dict")
        failed_items = [k for k, v in checklist.items() if v is not True]
        if failed_items:
            return GateResult(
                False,
                gate_type,
                description,
                f"Failed criteria: {', '.join(failed_items)}",
            )
        return GateResult(True, gate_type, description)

    # -------------------------------------------------------------------------
    # File-based gates
    # -------------------------------------------------------------------------

    if gate_type == "file_exists":
        path_param = params.get("path") or params.get("path_pattern")
        if not path_param or not repo_root:
            return GateResult(False, gate_type, description, "Missing path or repo_root")

        # Handle glob patterns
        if "*" in path_param:
            repo_path = Path(repo_root)
            matches = list(repo_path.glob(path_param))
            if matches:
                return GateResult(True, gate_type, description, f"Found {len(matches)} matching files")
            return GateResult(False, gate_type, description, f"No files match pattern: {path_param}")

        full_path = Path(repo_root) / path_param
        if full_path.exists():
            return GateResult(True, gate_type, description)
        return GateResult(False, gate_type, description, f"File not found: {path_param}")

    if gate_type == "file_not_exists":
        path_param = params.get("path")
        if not path_param or not repo_root:
            return GateResult(False, gate_type, description, "Missing path or repo_root")
        full_path = Path(repo_root) / path_param
        if not full_path.exists():
            return GateResult(True, gate_type, description)
        return GateResult(False, gate_type, description, f"File exists but shouldn't: {path_param}")

    if gate_type == "changed_files_allowlist":
        allowed = params.get("allowed", [])
        actual_changed = changed_files or evidence.get("changed_files", [])
        disallowed = []
        for f in actual_changed:
            f_normalized = f.replace("\\", "/")
            if not _path_matches_patterns(f_normalized, allowed):
                disallowed.append(f)
        if disallowed:
            return GateResult(
                False,
                gate_type,
                description,
                f"Files changed outside allowlist: {', '.join(disallowed)}",
            )
        return GateResult(True, gate_type, description)

    if gate_type == "forbid_paths":
        forbidden = params.get("paths", [])
        actual_changed = changed_files or evidence.get("changed_files", [])
        violations = []
        for f in actual_changed:
            f_normalized = f.replace("\\", "/")
            if _path_matches_patterns(f_normalized, forbidden):
                violations.append(f)
        if violations:
            return GateResult(
                False,
                gate_type,
                description,
                f"Forbidden files were changed: {', '.join(violations)}",
            )
        return GateResult(True, gate_type, description)

    if gate_type == "changed_files_minimum":
        paths = params.get("paths", [])
        min_count = params.get("min_count", 1)
        actual_changed = changed_files or evidence.get("changed_files", [])
        matched = 0
        for f in actual_changed:
            f_normalized = f.replace("\\", "/")
            if _path_matches_patterns(f_normalized, paths):
                matched += 1
        if matched >= min_count:
            return GateResult(True, gate_type, description)
        return GateResult(
            False,
            gate_type,
            description,
            f"Expected at least {min_count} changes to {paths}, got {matched}",
        )

    # -------------------------------------------------------------------------
    # Diff-based gates
    # -------------------------------------------------------------------------

    if gate_type == "diff_max_lines":
        max_lines = params.get("max", 500)
        # This would need git integration to count actual diff lines
        # For now, estimate from changed_files count
        actual_changed = changed_files or evidence.get("changed_files", [])
        # Rough estimate: assume average 50 lines per file
        estimated_lines = len(actual_changed) * 50
        diff_lines = evidence.get("diff_lines", estimated_lines)

        if isinstance(diff_lines, int) and diff_lines <= max_lines:
            return GateResult(True, gate_type, description)
        if max_lines == 0 and len(actual_changed) == 0:
            return GateResult(True, gate_type, description)
        if max_lines == 0 and len(actual_changed) > 0:
            return GateResult(False, gate_type, description, "No changes allowed")
        return GateResult(
            False,
            gate_type,
            description,
            f"Estimated {diff_lines} lines changed, max is {max_lines}",
        )

    if gate_type == "diff_min_lines":
        min_lines = params.get("min", 1)
        actual_changed = changed_files or evidence.get("changed_files", [])
        diff_lines = evidence.get("diff_lines", len(actual_changed) * 50)
        if isinstance(diff_lines, int) and diff_lines >= min_lines:
            return GateResult(True, gate_type, description)
        return GateResult(
            False,
            gate_type,
            description,
            f"Estimated {diff_lines} lines changed, min is {min_lines}",
        )

    # -------------------------------------------------------------------------
    # Command gates (require shell execution)
    # -------------------------------------------------------------------------

    if gate_type == "command_exit_0":
        # Check if shell gates are enabled
        if not policies.get("enable_shell_gates", False):
            return GateResult(
                True,
                gate_type,
                description,
                "Shell gates disabled by policy - skipped",
            )

        command = params.get("command")
        if not command:
            return GateResult(False, gate_type, description, "No command specified")

        # Check allowlist
        allowlist = policies.get("shell_gate_allowlist", [])
        if allowlist and not command_matches_allowlist(command, allowlist):
            return GateResult(
                False,
                gate_type,
                description,
                f"Command not in allowlist: {command}",
            )

        timeout = params.get("timeout", 60)
        passed, output, exit_code = await execute_shell_gate(
            command,
            cwd=repo_root,
            timeout=timeout,
        )

        return GateResult(
            passed,
            gate_type,
            description,
            f"Exit code: {exit_code}",
            output=output,
            exit_code=exit_code,
        )

    if gate_type == "command_output_contains":
        if not policies.get("enable_shell_gates", False):
            return GateResult(True, gate_type, description, "Shell gates disabled - skipped")

        command = params.get("command")
        contains = params.get("contains", "")
        if not command:
            return GateResult(False, gate_type, description, "No command specified")

        allowlist = policies.get("shell_gate_allowlist", [])
        if allowlist and not command_matches_allowlist(command, allowlist):
            return GateResult(False, gate_type, description, "Command not in allowlist")

        timeout = params.get("timeout", 60)
        passed, output, exit_code = await execute_shell_gate(command, cwd=repo_root, timeout=timeout)

        if contains.lower() in output.lower():
            return GateResult(True, gate_type, description, output=output, exit_code=exit_code)
        return GateResult(
            False,
            gate_type,
            description,
            f"Output does not contain: {contains}",
            output=output,
            exit_code=exit_code,
        )

    # -------------------------------------------------------------------------
    # Human approval gate
    # -------------------------------------------------------------------------

    if gate_type == "human_approval":
        # This gate is handled at a higher level (step.human_review flag)
        return GateResult(True, gate_type, description, "Handled by step.human_review")

    # -------------------------------------------------------------------------
    # Unknown gate type
    # -------------------------------------------------------------------------

    return GateResult(
        False,
        gate_type,
        description,
        f"Unknown gate type: {gate_type}",
    )


async def evaluate_gates(
    gates: list[dict[str, Any]],
    *,
    evidence: dict[str, Any],
    repo_root: str | None = None,
    policies: dict[str, Any] | None = None,
    changed_files: list[str] | None = None,
) -> tuple[bool, list[GateResult]]:
    """
    Evaluate all gates for a step.

    Returns:
        Tuple of (all_passed, list_of_results)
    """
    results = []
    all_passed = True

    for gate in gates:
        result = await evaluate_gate(
            gate,
            evidence=evidence,
            repo_root=repo_root,
            policies=policies,
            changed_files=changed_files,
        )
        results.append(result)
        if not result.passed:
            all_passed = False

    return all_passed, results


def _path_matches_patterns(path: str, patterns: list[str]) -> bool:
    """Check if a path matches any of the given glob patterns."""
    for pattern in patterns:
        pattern = pattern.replace("\\", "/")
        if fnmatch.fnmatch(path, pattern):
            return True
        # Also check direct match
        if path == pattern:
            return True
    return False
