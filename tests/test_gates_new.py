"""Tests for the gates execution module."""

import pytest
import asyncio
import tempfile
from pathlib import Path

from vibedev_mcp.gates import (
    GateResult,
    command_matches_allowlist,
    execute_shell_gate,
    evaluate_gate,
    evaluate_gates,
)


class TestGateResult:
    def test_to_dict_basic(self):
        result = GateResult(
            passed=True,
            gate_type="tests_passed",
            description="All tests pass",
        )
        d = result.to_dict()
        assert d["passed"] is True
        assert d["gate_type"] == "tests_passed"
        assert d["description"] == "All tests pass"

    def test_to_dict_with_output(self):
        result = GateResult(
            passed=False,
            gate_type="command_exit_0",
            description="pytest",
            output="FAILED test_foo.py",
            exit_code=1,
        )
        d = result.to_dict()
        assert d["exit_code"] == 1
        assert "FAILED" in d["output"]

    def test_output_truncation(self):
        long_output = "x" * 5000
        result = GateResult(
            passed=False,
            gate_type="command_exit_0",
            description="test",
            output=long_output,
        )
        d = result.to_dict()
        assert len(d["output"]) <= 2000


class TestCommandMatchesAllowlist:
    def test_exact_match(self):
        assert command_matches_allowlist("pytest", ["pytest"])

    def test_wildcard_match(self):
        assert command_matches_allowlist("python -m pytest", ["*pytest*"])

    def test_prefix_wildcard(self):
        assert command_matches_allowlist("npm run build", ["*npm run build*"])

    def test_no_match(self):
        assert not command_matches_allowlist("rm -rf /", ["pytest", "npm run build"])

    def test_case_insensitive(self):
        assert command_matches_allowlist("PYTEST", ["*pytest*"])

    def test_glob_pattern(self):
        assert command_matches_allowlist("python -m pytest tests/", ["*python* -m pytest*"])


class TestExecuteShellGate:
    @pytest.mark.asyncio
    async def test_successful_command(self):
        # echo always succeeds
        passed, output, exit_code = await execute_shell_gate("echo hello")
        assert passed is True
        assert exit_code == 0
        assert "hello" in output

    @pytest.mark.asyncio
    async def test_failing_command(self):
        # exit 1 always fails
        passed, output, exit_code = await execute_shell_gate("exit 1")
        assert passed is False
        assert exit_code == 1

    @pytest.mark.asyncio
    async def test_command_with_cwd(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            passed, output, exit_code = await execute_shell_gate("cd", cwd=tmpdir)
            # cd should succeed
            assert exit_code == 0

    @pytest.mark.asyncio
    async def test_command_timeout(self):
        # This should timeout (sleep for 10s with 1s timeout)
        import sys
        if sys.platform == "win32":
            cmd = "ping -n 10 127.0.0.1"
        else:
            cmd = "sleep 10"
        passed, output, exit_code = await execute_shell_gate(cmd, timeout=1)
        assert passed is False
        assert "timed out" in output.lower()


class TestEvaluateGate:
    @pytest.mark.asyncio
    async def test_tests_passed_gate(self):
        result = await evaluate_gate(
            {"type": "tests_passed", "description": "Tests pass"},
            evidence={"tests_passed": True},
        )
        assert result.passed is True

    @pytest.mark.asyncio
    async def test_tests_passed_gate_fails(self):
        result = await evaluate_gate(
            {"type": "tests_passed", "description": "Tests pass"},
            evidence={"tests_passed": False},
        )
        assert result.passed is False

    @pytest.mark.asyncio
    async def test_tests_passed_gate_missing(self):
        result = await evaluate_gate(
            {"type": "tests_passed", "description": "Tests pass"},
            evidence={},
        )
        assert result.passed is False

    @pytest.mark.asyncio
    async def test_criteria_checklist_complete(self):
        result = await evaluate_gate(
            {"type": "criteria_checklist_complete", "description": "All criteria met"},
            evidence={"criteria_checklist": {"c1": True, "c2": True}},
        )
        assert result.passed is True

    @pytest.mark.asyncio
    async def test_criteria_checklist_incomplete(self):
        result = await evaluate_gate(
            {"type": "criteria_checklist_complete", "description": "All criteria met"},
            evidence={"criteria_checklist": {"c1": True, "c2": False}},
        )
        assert result.passed is False

    @pytest.mark.asyncio
    async def test_file_exists_gate(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create a file
            test_file = Path(tmpdir) / "test.txt"
            test_file.write_text("hello")

            result = await evaluate_gate(
                {"type": "file_exists", "parameters": {"path": "test.txt"}, "description": "File exists"},
                evidence={},
                repo_root=tmpdir,
            )
            assert result.passed is True

    @pytest.mark.asyncio
    async def test_file_exists_gate_missing(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            result = await evaluate_gate(
                {"type": "file_exists", "parameters": {"path": "nonexistent.txt"}, "description": "File exists"},
                evidence={},
                repo_root=tmpdir,
            )
            assert result.passed is False

    @pytest.mark.asyncio
    async def test_file_not_exists_gate(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            result = await evaluate_gate(
                {"type": "file_not_exists", "parameters": {"path": "nonexistent.txt"}, "description": "File doesn't exist"},
                evidence={},
                repo_root=tmpdir,
            )
            assert result.passed is True

    @pytest.mark.asyncio
    async def test_changed_files_allowlist(self):
        result = await evaluate_gate(
            {"type": "changed_files_allowlist", "parameters": {"allowed": ["src/*.py"]}, "description": "Only src files"},
            evidence={"changed_files": ["src/main.py", "src/utils.py"]},
        )
        assert result.passed is True

    @pytest.mark.asyncio
    async def test_changed_files_allowlist_violation(self):
        result = await evaluate_gate(
            {"type": "changed_files_allowlist", "parameters": {"allowed": ["src/*.py"]}, "description": "Only src files"},
            evidence={"changed_files": ["src/main.py", "package.json"]},
        )
        assert result.passed is False
        assert "package.json" in result.details

    @pytest.mark.asyncio
    async def test_forbid_paths_clean(self):
        result = await evaluate_gate(
            {"type": "forbid_paths", "parameters": {"paths": ["package.json", "*.lock"]}, "description": "No package changes"},
            evidence={"changed_files": ["src/main.py"]},
        )
        assert result.passed is True

    @pytest.mark.asyncio
    async def test_forbid_paths_violation(self):
        result = await evaluate_gate(
            {"type": "forbid_paths", "parameters": {"paths": ["package.json", "*.lock"]}, "description": "No package changes"},
            evidence={"changed_files": ["src/main.py", "package.json"]},
        )
        assert result.passed is False

    @pytest.mark.asyncio
    async def test_diff_max_lines_pass(self):
        result = await evaluate_gate(
            {"type": "diff_max_lines", "parameters": {"max": 500}, "description": "Keep diffs small"},
            evidence={"changed_files": ["src/main.py"], "diff_lines": 100},
        )
        assert result.passed is True

    @pytest.mark.asyncio
    async def test_diff_max_lines_zero_with_no_changes(self):
        result = await evaluate_gate(
            {"type": "diff_max_lines", "parameters": {"max": 0}, "description": "No changes allowed"},
            evidence={"changed_files": []},
        )
        assert result.passed is True

    @pytest.mark.asyncio
    async def test_diff_max_lines_zero_with_changes(self):
        result = await evaluate_gate(
            {"type": "diff_max_lines", "parameters": {"max": 0}, "description": "No changes allowed"},
            evidence={"changed_files": ["src/main.py"]},
        )
        assert result.passed is False

    @pytest.mark.asyncio
    async def test_command_exit_0_disabled_by_policy(self):
        result = await evaluate_gate(
            {"type": "command_exit_0", "parameters": {"command": "echo hello"}, "description": "Echo test"},
            evidence={},
            policies={"enable_shell_gates": False},
        )
        # Should pass because shell gates are disabled (skipped)
        assert result.passed is True
        assert "disabled" in result.details.lower()

    @pytest.mark.asyncio
    async def test_command_exit_0_enabled_and_passes(self):
        result = await evaluate_gate(
            {"type": "command_exit_0", "parameters": {"command": "echo hello"}, "description": "Echo test"},
            evidence={},
            policies={"enable_shell_gates": True, "shell_gate_allowlist": ["*echo*"]},
        )
        assert result.passed is True
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_command_exit_0_not_in_allowlist(self):
        result = await evaluate_gate(
            {"type": "command_exit_0", "parameters": {"command": "rm -rf /"}, "description": "Bad command"},
            evidence={},
            policies={"enable_shell_gates": True, "shell_gate_allowlist": ["*pytest*"]},
        )
        assert result.passed is False
        assert "allowlist" in result.details.lower()


class TestEvaluateGates:
    @pytest.mark.asyncio
    async def test_all_gates_pass(self):
        all_passed, results = await evaluate_gates(
            [
                {"type": "tests_passed", "description": "Tests"},
                {"type": "lint_passed", "description": "Lint"},
            ],
            evidence={"tests_passed": True, "lint_passed": True},
        )
        assert all_passed is True
        assert len(results) == 2
        assert all(r.passed for r in results)

    @pytest.mark.asyncio
    async def test_some_gates_fail(self):
        all_passed, results = await evaluate_gates(
            [
                {"type": "tests_passed", "description": "Tests"},
                {"type": "lint_passed", "description": "Lint"},
            ],
            evidence={"tests_passed": True, "lint_passed": False},
        )
        assert all_passed is False
        assert results[0].passed is True
        assert results[1].passed is False

    @pytest.mark.asyncio
    async def test_empty_gates_list(self):
        all_passed, results = await evaluate_gates([], evidence={})
        assert all_passed is True
        assert len(results) == 0
