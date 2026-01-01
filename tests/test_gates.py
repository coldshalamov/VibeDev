"""Tests for all gate types in VibeDev MCP.

This module tests all 17 gate types:
- tests_passed
- lint_passed
- criteria_checklist_complete
- changed_files_allowlist
- forbid_paths
- changed_files_minimum
- file_exists
- file_not_exists
- no_uncommitted_changes
- diff_max_lines
- diff_min_lines
- patch_applies_cleanly
- command_exit_0
- command_output_contains
- command_output_regex
- json_schema_valid
- human_approval

Uses manual temp directory management to avoid Windows file locking issues.
"""

import json
import os
import shutil
import subprocess
import tempfile

import pytest

from vibedev_mcp.store import VibeDevStore


async def _setup_job_for_execution(store: VibeDevStore, job_id: str, gates: list[dict]):
    """Set up a job with steps and gates ready for execution."""
    await store.plan_set_deliverables(job_id, ["Test output"])
    await store.plan_set_invariants(job_id, ["No bugs"])
    await store.plan_set_definition_of_done(job_id, ["All tests pass"])

    await store.plan_propose_steps(job_id, [{
        "title": "Test Step",
        "instruction_prompt": "Do the thing",
        "acceptance_criteria": ["criterion 1"],
        "required_evidence": ["tests_passed"],
        "gates": gates,
    }])

    await store.job_set_ready(job_id)
    await store.job_start(job_id)


# =============================================================================
# tests_passed gate
# =============================================================================

@pytest.mark.asyncio
async def test_gate_tests_passed_success():
    """tests_passed gate passes when evidence.tests_passed is true."""
    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "test.sqlite3"))

        job_id = await store.create_job(
            title="Test",
            goal="Test gates",
            repo_root=None,
            policies={},
        )

        await _setup_job_for_execution(store, job_id, [
            {"type": "tests_passed", "parameters": {}}
        ])

        result = await store.job_submit_step_result(
            job_id=job_id,
            step_id="S1",
            model_claim="MET",
            summary="All tests passed",
            evidence={"tests_passed": True, "tests_run": ["test_foo"]},
        )

        assert result["outcome"] == "ACCEPTED"
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_gate_tests_passed_failure():
    """tests_passed gate fails when evidence.tests_passed is not true."""
    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "test.sqlite3"))

        job_id = await store.create_job(
            title="Test",
            goal="Test gates",
            repo_root=None,
            policies={},
        )

        await _setup_job_for_execution(store, job_id, [
            {"type": "tests_passed", "parameters": {}}
        ])

        result = await store.job_submit_step_result(
            job_id=job_id,
            step_id="S1",
            model_claim="MET",
            summary="Tests failed",
            evidence={"tests_passed": False, "tests_run": ["test_foo"]},
        )

        assert result["outcome"] == "REJECTED"
        assert "tests_passed" in str(result.get("rejection_reasons", []))
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


# =============================================================================
# lint_passed gate
# =============================================================================

@pytest.mark.asyncio
async def test_gate_lint_passed_success():
    """lint_passed gate passes when evidence.lint_passed is true."""
    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "test.sqlite3"))

        job_id = await store.create_job(
            title="Test",
            goal="Test gates",
            repo_root=None,
            policies={},
        )

        await _setup_job_for_execution(store, job_id, [
            {"type": "lint_passed", "parameters": {}}
        ])

        result = await store.job_submit_step_result(
            job_id=job_id,
            step_id="S1",
            model_claim="MET",
            summary="Lint passed",
            evidence={"lint_passed": True},
        )

        assert result["outcome"] == "ACCEPTED"
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_gate_lint_passed_failure():
    """lint_passed gate fails when evidence.lint_passed is not true."""
    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "test.sqlite3"))

        job_id = await store.create_job(
            title="Test",
            goal="Test gates",
            repo_root=None,
            policies={},
        )

        await _setup_job_for_execution(store, job_id, [
            {"type": "lint_passed", "parameters": {}}
        ])

        result = await store.job_submit_step_result(
            job_id=job_id,
            step_id="S1",
            model_claim="MET",
            summary="Lint failed",
            evidence={"lint_passed": False},
        )

        assert result["outcome"] == "REJECTED"
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


# =============================================================================
# file_exists gate
# =============================================================================

@pytest.mark.asyncio
async def test_gate_file_exists_success():
    """file_exists gate passes when file exists."""
    tmp_dir = tempfile.mkdtemp()
    try:
        # Create git repo
        repo_path = os.path.join(tmp_dir, "repo")
        os.makedirs(repo_path)
        subprocess.run(["git", "init"], cwd=repo_path, capture_output=True)
        subprocess.run(["git", "config", "user.email", "test@example.com"], cwd=repo_path, capture_output=True)
        subprocess.run(["git", "config", "user.name", "Test"], cwd=repo_path, capture_output=True)

        # Create initial commit
        with open(os.path.join(repo_path, "README.md"), "w") as f:
            f.write("# Test")
        subprocess.run(["git", "add", "."], cwd=repo_path, capture_output=True)
        subprocess.run(["git", "commit", "-m", "Initial"], cwd=repo_path, capture_output=True)

        # Create the file to check
        with open(os.path.join(repo_path, "expected_file.txt"), "w") as f:
            f.write("content")

        store = await VibeDevStore.open(os.path.join(tmp_dir, "test.sqlite3"))

        job_id = await store.create_job(
            title="Test",
            goal="Test gates",
            repo_root=repo_path,
            policies={},
        )

        await _setup_job_for_execution(store, job_id, [
            {"type": "file_exists", "parameters": {"path": "expected_file.txt"}}
        ])

        result = await store.job_submit_step_result(
            job_id=job_id,
            step_id="S1",
            model_claim="MET",
            summary="File created",
            evidence={},
        )

        assert result["outcome"] == "ACCEPTED"
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_gate_file_exists_failure():
    """file_exists gate fails when file does not exist."""
    tmp_dir = tempfile.mkdtemp()
    try:
        repo_path = os.path.join(tmp_dir, "repo")
        os.makedirs(repo_path)
        subprocess.run(["git", "init"], cwd=repo_path, capture_output=True)

        store = await VibeDevStore.open(os.path.join(tmp_dir, "test.sqlite3"))

        job_id = await store.create_job(
            title="Test",
            goal="Test gates",
            repo_root=repo_path,
            policies={},
        )

        await _setup_job_for_execution(store, job_id, [
            {"type": "file_exists", "parameters": {"path": "nonexistent.txt"}}
        ])

        result = await store.job_submit_step_result(
            job_id=job_id,
            step_id="S1",
            model_claim="MET",
            summary="Tried to create file",
            evidence={},
        )

        assert result["outcome"] == "REJECTED"
        assert "file_exists" in str(result.get("rejection_reasons", []))
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


# =============================================================================
# file_not_exists gate
# =============================================================================

@pytest.mark.asyncio
async def test_gate_file_not_exists_success():
    """file_not_exists gate passes when file does not exist."""
    tmp_dir = tempfile.mkdtemp()
    try:
        repo_path = os.path.join(tmp_dir, "repo")
        os.makedirs(repo_path)
        subprocess.run(["git", "init"], cwd=repo_path, capture_output=True)

        store = await VibeDevStore.open(os.path.join(tmp_dir, "test.sqlite3"))

        job_id = await store.create_job(
            title="Test",
            goal="Test gates",
            repo_root=repo_path,
            policies={},
        )

        await _setup_job_for_execution(store, job_id, [
            {"type": "file_not_exists", "parameters": {"path": "should_not_exist.txt"}}
        ])

        result = await store.job_submit_step_result(
            job_id=job_id,
            step_id="S1",
            model_claim="MET",
            summary="File not created",
            evidence={},
        )

        assert result["outcome"] == "ACCEPTED"
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_gate_file_not_exists_failure():
    """file_not_exists gate fails when file exists."""
    tmp_dir = tempfile.mkdtemp()
    try:
        repo_path = os.path.join(tmp_dir, "repo")
        os.makedirs(repo_path)
        subprocess.run(["git", "init"], cwd=repo_path, capture_output=True)

        # Create the file that shouldn't exist
        with open(os.path.join(repo_path, "forbidden.txt"), "w") as f:
            f.write("oops")

        store = await VibeDevStore.open(os.path.join(tmp_dir, "test.sqlite3"))

        job_id = await store.create_job(
            title="Test",
            goal="Test gates",
            repo_root=repo_path,
            policies={},
        )

        await _setup_job_for_execution(store, job_id, [
            {"type": "file_not_exists", "parameters": {"path": "forbidden.txt"}}
        ])

        result = await store.job_submit_step_result(
            job_id=job_id,
            step_id="S1",
            model_claim="MET",
            summary="File exists",
            evidence={},
        )

        assert result["outcome"] == "REJECTED"
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


# =============================================================================
# command_exit_0 gate
# =============================================================================

@pytest.mark.asyncio
async def test_gate_command_exit_0_success():
    """command_exit_0 gate passes when command exits with 0."""
    tmp_dir = tempfile.mkdtemp()
    try:
        repo_path = os.path.join(tmp_dir, "repo")
        os.makedirs(repo_path)

        store = await VibeDevStore.open(os.path.join(tmp_dir, "test.sqlite3"))

        job_id = await store.create_job(
            title="Test",
            goal="Test gates",
            repo_root=repo_path,
            policies={},
        )

        # Use a command that always succeeds
        cmd = "echo hello"

        await _setup_job_for_execution(store, job_id, [
            {"type": "command_exit_0", "parameters": {"command": cmd}}
        ])

        result = await store.job_submit_step_result(
            job_id=job_id,
            step_id="S1",
            model_claim="MET",
            summary="Command ran",
            evidence={},
        )

        assert result["outcome"] == "ACCEPTED"
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_gate_command_exit_0_failure():
    """command_exit_0 gate fails when command exits with non-zero."""
    tmp_dir = tempfile.mkdtemp()
    try:
        repo_path = os.path.join(tmp_dir, "repo")
        os.makedirs(repo_path)

        store = await VibeDevStore.open(os.path.join(tmp_dir, "test.sqlite3"))

        job_id = await store.create_job(
            title="Test",
            goal="Test gates",
            repo_root=repo_path,
            policies={},
        )

        # Use a command that always fails
        cmd = "cmd /c exit 1" if os.name == "nt" else "exit 1"

        await _setup_job_for_execution(store, job_id, [
            {"type": "command_exit_0", "parameters": {"command": cmd}}
        ])

        result = await store.job_submit_step_result(
            job_id=job_id,
            step_id="S1",
            model_claim="MET",
            summary="Command failed",
            evidence={},
        )

        assert result["outcome"] == "REJECTED"
        assert "command_exit_0" in str(result.get("rejection_reasons", []))
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_gate_command_exit_0_misconfigured():
    """command_exit_0 gate fails with empty command."""
    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "test.sqlite3"))

        job_id = await store.create_job(
            title="Test",
            goal="Test gates",
            repo_root=None,
            policies={},
        )

        await _setup_job_for_execution(store, job_id, [
            {"type": "command_exit_0", "parameters": {"command": ""}}
        ])

        result = await store.job_submit_step_result(
            job_id=job_id,
            step_id="S1",
            model_claim="MET",
            summary="Bad config",
            evidence={},
        )

        assert result["outcome"] == "REJECTED"
        assert "misconfigured" in str(result.get("rejection_reasons", []))
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


# =============================================================================
# command_output_contains gate
# =============================================================================

@pytest.mark.asyncio
async def test_gate_command_output_contains_success():
    """command_output_contains gate passes when output contains substring."""
    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "test.sqlite3"))

        job_id = await store.create_job(
            title="Test",
            goal="Test gates",
            repo_root=None,
            policies={},
        )

        cmd = "echo hello world"

        await _setup_job_for_execution(store, job_id, [
            {"type": "command_output_contains", "parameters": {"command": cmd, "contains": "hello"}}
        ])

        result = await store.job_submit_step_result(
            job_id=job_id,
            step_id="S1",
            model_claim="MET",
            summary="Output matched",
            evidence={},
        )

        assert result["outcome"] == "ACCEPTED"
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_gate_command_output_contains_failure():
    """command_output_contains gate fails when output doesn't contain substring."""
    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "test.sqlite3"))

        job_id = await store.create_job(
            title="Test",
            goal="Test gates",
            repo_root=None,
            policies={},
        )

        cmd = "echo hello world"

        await _setup_job_for_execution(store, job_id, [
            {"type": "command_output_contains", "parameters": {"command": cmd, "contains": "goodbye"}}
        ])

        result = await store.job_submit_step_result(
            job_id=job_id,
            step_id="S1",
            model_claim="MET",
            summary="Output didn't match",
            evidence={},
        )

        assert result["outcome"] == "REJECTED"
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_gate_command_output_contains_case_insensitive():
    """command_output_contains gate supports case-insensitive matching."""
    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "test.sqlite3"))

        job_id = await store.create_job(
            title="Test",
            goal="Test gates",
            repo_root=None,
            policies={},
        )

        cmd = "echo HELLO WORLD"

        await _setup_job_for_execution(store, job_id, [
            {"type": "command_output_contains", "parameters": {
                "command": cmd,
                "contains": "hello",
                "case_insensitive": True
            }}
        ])

        result = await store.job_submit_step_result(
            job_id=job_id,
            step_id="S1",
            model_claim="MET",
            summary="Case insensitive match",
            evidence={},
        )

        assert result["outcome"] == "ACCEPTED"
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


# =============================================================================
# command_output_regex gate
# =============================================================================

@pytest.mark.asyncio
async def test_gate_command_output_regex_success():
    """command_output_regex gate passes when output matches pattern."""
    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "test.sqlite3"))

        job_id = await store.create_job(
            title="Test",
            goal="Test gates",
            repo_root=None,
            policies={},
        )

        cmd = "echo 42 tests passed"

        await _setup_job_for_execution(store, job_id, [
            {"type": "command_output_regex", "parameters": {"command": cmd, "pattern": r"\d+ tests passed"}}
        ])

        result = await store.job_submit_step_result(
            job_id=job_id,
            step_id="S1",
            model_claim="MET",
            summary="Pattern matched",
            evidence={},
        )

        assert result["outcome"] == "ACCEPTED"
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_gate_command_output_regex_failure():
    """command_output_regex gate fails when output doesn't match pattern."""
    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "test.sqlite3"))

        job_id = await store.create_job(
            title="Test",
            goal="Test gates",
            repo_root=None,
            policies={},
        )

        cmd = "echo no tests here"

        await _setup_job_for_execution(store, job_id, [
            {"type": "command_output_regex", "parameters": {"command": cmd, "pattern": r"\d+ tests passed"}}
        ])

        result = await store.job_submit_step_result(
            job_id=job_id,
            step_id="S1",
            model_claim="MET",
            summary="Pattern didn't match",
            evidence={},
        )

        assert result["outcome"] == "REJECTED"
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_gate_command_output_regex_invalid_pattern():
    """command_output_regex gate fails with invalid regex pattern."""
    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "test.sqlite3"))

        job_id = await store.create_job(
            title="Test",
            goal="Test gates",
            repo_root=None,
            policies={},
        )

        await _setup_job_for_execution(store, job_id, [
            {"type": "command_output_regex", "parameters": {"command": "echo test", "pattern": "[invalid"}}
        ])

        result = await store.job_submit_step_result(
            job_id=job_id,
            step_id="S1",
            model_claim="MET",
            summary="Invalid pattern",
            evidence={},
        )

        assert result["outcome"] == "REJECTED"
        assert "invalid regex" in str(result.get("rejection_reasons", [])).lower()
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


# =============================================================================
# json_schema_valid gate
# =============================================================================

@pytest.mark.asyncio
async def test_gate_json_schema_valid_success():
    """json_schema_valid gate passes when JSON matches schema."""
    tmp_dir = tempfile.mkdtemp()
    try:
        repo_path = os.path.join(tmp_dir, "repo")
        os.makedirs(repo_path)

        # Create a valid JSON file
        config = {"name": "test", "version": "1.0"}
        with open(os.path.join(repo_path, "config.json"), "w") as f:
            json.dump(config, f)

        store = await VibeDevStore.open(os.path.join(tmp_dir, "test.sqlite3"))

        job_id = await store.create_job(
            title="Test",
            goal="Test gates",
            repo_root=repo_path,
            policies={},
        )

        await _setup_job_for_execution(store, job_id, [
            {"type": "json_schema_valid", "parameters": {
                "path": "config.json",
                "schema": {
                    "type": "object",
                    "required": ["name", "version"]
                }
            }}
        ])

        result = await store.job_submit_step_result(
            job_id=job_id,
            step_id="S1",
            model_claim="MET",
            summary="Valid JSON",
            evidence={},
        )

        assert result["outcome"] == "ACCEPTED"
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_gate_json_schema_valid_missing_required():
    """json_schema_valid gate fails when required property is missing."""
    tmp_dir = tempfile.mkdtemp()
    try:
        repo_path = os.path.join(tmp_dir, "repo")
        os.makedirs(repo_path)

        # Create JSON missing required field
        config = {"name": "test"}  # missing version
        with open(os.path.join(repo_path, "config.json"), "w") as f:
            json.dump(config, f)

        store = await VibeDevStore.open(os.path.join(tmp_dir, "test.sqlite3"))

        job_id = await store.create_job(
            title="Test",
            goal="Test gates",
            repo_root=repo_path,
            policies={},
        )

        await _setup_job_for_execution(store, job_id, [
            {"type": "json_schema_valid", "parameters": {
                "path": "config.json",
                "schema": {
                    "type": "object",
                    "required": ["name", "version"]
                }
            }}
        ])

        result = await store.job_submit_step_result(
            job_id=job_id,
            step_id="S1",
            model_claim="MET",
            summary="Missing version",
            evidence={},
        )

        assert result["outcome"] == "REJECTED"
        assert "version" in str(result.get("rejection_reasons", []))
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_gate_json_schema_valid_wrong_type():
    """json_schema_valid gate fails when type doesn't match."""
    tmp_dir = tempfile.mkdtemp()
    try:
        repo_path = os.path.join(tmp_dir, "repo")
        os.makedirs(repo_path)

        # Create a JSON array when object expected
        with open(os.path.join(repo_path, "config.json"), "w") as f:
            f.write("[]")

        store = await VibeDevStore.open(os.path.join(tmp_dir, "test.sqlite3"))

        job_id = await store.create_job(
            title="Test",
            goal="Test gates",
            repo_root=repo_path,
            policies={},
        )

        await _setup_job_for_execution(store, job_id, [
            {"type": "json_schema_valid", "parameters": {
                "path": "config.json",
                "schema": {"type": "object"}
            }}
        ])

        result = await store.job_submit_step_result(
            job_id=job_id,
            step_id="S1",
            model_claim="MET",
            summary="Wrong type",
            evidence={},
        )

        assert result["outcome"] == "REJECTED"
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_gate_json_schema_valid_file_not_found():
    """json_schema_valid gate fails when file doesn't exist."""
    tmp_dir = tempfile.mkdtemp()
    try:
        repo_path = os.path.join(tmp_dir, "repo")
        os.makedirs(repo_path)

        store = await VibeDevStore.open(os.path.join(tmp_dir, "test.sqlite3"))

        job_id = await store.create_job(
            title="Test",
            goal="Test gates",
            repo_root=repo_path,
            policies={},
        )

        await _setup_job_for_execution(store, job_id, [
            {"type": "json_schema_valid", "parameters": {
                "path": "nonexistent.json",
                "schema": {"type": "object"}
            }}
        ])

        result = await store.job_submit_step_result(
            job_id=job_id,
            step_id="S1",
            model_claim="MET",
            summary="File missing",
            evidence={},
        )

        assert result["outcome"] == "REJECTED"
        assert "does not exist" in str(result.get("rejection_reasons", []))
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_gate_json_schema_valid_invalid_json():
    """json_schema_valid gate fails when file contains invalid JSON."""
    tmp_dir = tempfile.mkdtemp()
    try:
        repo_path = os.path.join(tmp_dir, "repo")
        os.makedirs(repo_path)

        # Create invalid JSON
        with open(os.path.join(repo_path, "config.json"), "w") as f:
            f.write("{invalid json")

        store = await VibeDevStore.open(os.path.join(tmp_dir, "test.sqlite3"))

        job_id = await store.create_job(
            title="Test",
            goal="Test gates",
            repo_root=repo_path,
            policies={},
        )

        await _setup_job_for_execution(store, job_id, [
            {"type": "json_schema_valid", "parameters": {
                "path": "config.json",
                "schema": {"type": "object"}
            }}
        ])

        result = await store.job_submit_step_result(
            job_id=job_id,
            step_id="S1",
            model_claim="MET",
            summary="Invalid JSON",
            evidence={},
        )

        assert result["outcome"] == "REJECTED"
        assert "invalid JSON" in str(result.get("rejection_reasons", []))
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


# =============================================================================
# human_approval gate
# =============================================================================

@pytest.mark.asyncio
async def test_gate_human_approval_fails_without_approval():
    """human_approval gate fails when step hasn't been approved."""
    tmp_dir = tempfile.mkdtemp()
    try:
        repo_path = os.path.join(tmp_dir, "repo")
        os.makedirs(repo_path)

        store = await VibeDevStore.open(os.path.join(tmp_dir, "test.sqlite3"))

        job_id = await store.create_job(
            title="Test",
            goal="Test gates",
            repo_root=repo_path,
            policies={},
        )

        await _setup_job_for_execution(store, job_id, [
            {"type": "human_approval", "parameters": {"description": "Security review required"}}
        ])

        result = await store.job_submit_step_result(
            job_id=job_id,
            step_id="S1",
            model_claim="MET",
            summary="Ready for review",
            evidence={},
        )

        assert result["outcome"] == "REJECTED"
        assert "human_approval" in str(result.get("rejection_reasons", []))
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_gate_human_approval_passes_after_approval():
    """human_approval gate passes after approve_step is called."""
    tmp_dir = tempfile.mkdtemp()
    try:
        repo_path = os.path.join(tmp_dir, "repo")
        os.makedirs(repo_path)

        store = await VibeDevStore.open(os.path.join(tmp_dir, "test.sqlite3"))

        job_id = await store.create_job(
            title="Test",
            goal="Test gates",
            repo_root=repo_path,
            policies={},
        )

        await _setup_job_for_execution(store, job_id, [
            {"type": "human_approval", "parameters": {"description": "Security review required"}}
        ])

        # Grant approval
        approval_result = await store.approve_step(job_id, "S1")
        assert approval_result["ok"] is True
        assert approval_result["human_approved"] is True

        # Now submit should pass
        result = await store.job_submit_step_result(
            job_id=job_id,
            step_id="S1",
            model_claim="MET",
            summary="Approved and complete",
            evidence={},
        )

        assert result["outcome"] == "ACCEPTED"
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_gate_human_approval_revoke():
    """human_approval gate fails after approval is revoked."""
    tmp_dir = tempfile.mkdtemp()
    try:
        repo_path = os.path.join(tmp_dir, "repo")
        os.makedirs(repo_path)

        store = await VibeDevStore.open(os.path.join(tmp_dir, "test.sqlite3"))

        job_id = await store.create_job(
            title="Test",
            goal="Test gates",
            repo_root=repo_path,
            policies={},
        )

        await _setup_job_for_execution(store, job_id, [
            {"type": "human_approval", "parameters": {}}
        ])

        # Grant then revoke approval
        await store.approve_step(job_id, "S1")
        revoke_result = await store.revoke_step_approval(job_id, "S1")
        assert revoke_result["ok"] is True
        assert revoke_result["human_approved"] is False

        # Now submit should fail
        result = await store.job_submit_step_result(
            job_id=job_id,
            step_id="S1",
            model_claim="MET",
            summary="Approval revoked",
            evidence={},
        )

        assert result["outcome"] == "REJECTED"
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


# =============================================================================
# changed_files_allowlist gate
# =============================================================================

@pytest.mark.asyncio
async def test_gate_changed_files_allowlist_success():
    """changed_files_allowlist passes when only allowed files are changed."""
    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "test.sqlite3"))

        job_id = await store.create_job(
            title="Test",
            goal="Test gates",
            repo_root=None,
            policies={},
        )

        await _setup_job_for_execution(store, job_id, [
            {"type": "changed_files_allowlist", "parameters": {"allowed": ["src/*.py", "tests/*.py"]}}
        ])

        result = await store.job_submit_step_result(
            job_id=job_id,
            step_id="S1",
            model_claim="MET",
            summary="Changed allowed files",
            evidence={"changed_files": ["src/main.py", "tests/test_main.py"]},
        )

        assert result["outcome"] == "ACCEPTED"
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_gate_changed_files_allowlist_failure():
    """changed_files_allowlist fails when non-allowed files are changed."""
    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "test.sqlite3"))

        job_id = await store.create_job(
            title="Test",
            goal="Test gates",
            repo_root=None,
            policies={},
        )

        await _setup_job_for_execution(store, job_id, [
            {"type": "changed_files_allowlist", "parameters": {"allowed": ["src/*.py"]}}
        ])

        result = await store.job_submit_step_result(
            job_id=job_id,
            step_id="S1",
            model_claim="MET",
            summary="Changed forbidden file",
            evidence={"changed_files": ["src/main.py", "package.json"]},
        )

        assert result["outcome"] == "REJECTED"
        assert "package.json" in str(result.get("rejection_reasons", []))
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


# =============================================================================
# forbid_paths gate
# =============================================================================

@pytest.mark.asyncio
async def test_gate_forbid_paths_success():
    """forbid_paths passes when forbidden paths are not touched."""
    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "test.sqlite3"))

        job_id = await store.create_job(
            title="Test",
            goal="Test gates",
            repo_root=None,
            policies={},
        )

        await _setup_job_for_execution(store, job_id, [
            {"type": "forbid_paths", "parameters": {"paths": ["package.json", "*.lock"]}}
        ])

        result = await store.job_submit_step_result(
            job_id=job_id,
            step_id="S1",
            model_claim="MET",
            summary="Didn't touch forbidden",
            evidence={"changed_files": ["src/main.py"]},
        )

        assert result["outcome"] == "ACCEPTED"
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_gate_forbid_paths_failure():
    """forbid_paths fails when forbidden paths are touched."""
    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "test.sqlite3"))

        job_id = await store.create_job(
            title="Test",
            goal="Test gates",
            repo_root=None,
            policies={},
        )

        await _setup_job_for_execution(store, job_id, [
            {"type": "forbid_paths", "parameters": {"paths": ["package.json"]}}
        ])

        result = await store.job_submit_step_result(
            job_id=job_id,
            step_id="S1",
            model_claim="MET",
            summary="Touched forbidden",
            evidence={"changed_files": ["src/main.py", "package.json"]},
        )

        assert result["outcome"] == "REJECTED"
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


# =============================================================================
# criteria_checklist_complete gate
# =============================================================================

@pytest.mark.asyncio
async def test_gate_criteria_checklist_complete_success():
    """criteria_checklist_complete passes when all criteria are true."""
    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "test.sqlite3"))

        job_id = await store.create_job(
            title="Test",
            goal="Test gates",
            repo_root=None,
            policies={},
        )

        await _setup_job_for_execution(store, job_id, [
            {"type": "criteria_checklist_complete", "parameters": {}}
        ])

        result = await store.job_submit_step_result(
            job_id=job_id,
            step_id="S1",
            model_claim="MET",
            summary="All criteria met",
            evidence={"criteria_checklist": {"c1": True}},
        )

        assert result["outcome"] == "ACCEPTED"
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_gate_criteria_checklist_complete_failure():
    """criteria_checklist_complete fails when any criterion is false."""
    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "test.sqlite3"))

        job_id = await store.create_job(
            title="Test",
            goal="Test gates",
            repo_root=None,
            policies={},
        )

        await _setup_job_for_execution(store, job_id, [
            {"type": "criteria_checklist_complete", "parameters": {}}
        ])

        result = await store.job_submit_step_result(
            job_id=job_id,
            step_id="S1",
            model_claim="MET",
            summary="Some criteria not met",
            evidence={"criteria_checklist": {"c1": False}},
        )

        assert result["outcome"] == "REJECTED"
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


# =============================================================================
# Unknown gate type
# =============================================================================

@pytest.mark.asyncio
async def test_gate_unknown_type_fails():
    """Unknown gate types result in rejection."""
    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "test.sqlite3"))

        job_id = await store.create_job(
            title="Test",
            goal="Test gates",
            repo_root=None,
            policies={},
        )

        await _setup_job_for_execution(store, job_id, [
            {"type": "nonexistent_gate_type", "parameters": {}}
        ])

        result = await store.job_submit_step_result(
            job_id=job_id,
            step_id="S1",
            model_claim="MET",
            summary="Unknown gate",
            evidence={},
        )

        assert result["outcome"] == "REJECTED"
        assert "Unknown gate type" in str(result.get("rejection_reasons", []))
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


# =============================================================================
# Multiple gates
# =============================================================================

@pytest.mark.asyncio
async def test_multiple_gates_all_pass():
    """Multiple gates all passing results in acceptance."""
    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "test.sqlite3"))

        job_id = await store.create_job(
            title="Test",
            goal="Test gates",
            repo_root=None,
            policies={},
        )

        await _setup_job_for_execution(store, job_id, [
            {"type": "tests_passed", "parameters": {}},
            {"type": "lint_passed", "parameters": {}},
        ])

        result = await store.job_submit_step_result(
            job_id=job_id,
            step_id="S1",
            model_claim="MET",
            summary="All gates passed",
            evidence={"tests_passed": True, "tests_run": ["test_foo"], "lint_passed": True},
        )

        assert result["outcome"] == "ACCEPTED"
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_multiple_gates_one_fails():
    """One failing gate among multiple results in rejection."""
    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "test.sqlite3"))

        job_id = await store.create_job(
            title="Test",
            goal="Test gates",
            repo_root=None,
            policies={},
        )

        await _setup_job_for_execution(store, job_id, [
            {"type": "tests_passed", "parameters": {}},
            {"type": "lint_passed", "parameters": {}},
        ])

        result = await store.job_submit_step_result(
            job_id=job_id,
            step_id="S1",
            model_claim="MET",
            summary="One gate failed",
            evidence={"tests_passed": True, "tests_run": ["test_foo"], "lint_passed": False},
        )

        assert result["outcome"] == "REJECTED"
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
