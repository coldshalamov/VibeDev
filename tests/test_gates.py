"""Gate tests (backend verifier).

These tests validate the gate catalog as implemented by `VibeDevStore._evaluate_step_gates`.
They intentionally avoid the full execution pipeline unless the gate requires DB state
(e.g. `human_approval`) or git state (diff/no_uncommitted/patch gates).
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

import pytest

from vibedev_mcp.store import VibeDevStore


async def _new_store_and_job(
    *,
    tmp_dir: str,
    repo_root: str | None,
    policies: dict | None = None,
) -> tuple[VibeDevStore, str]:
    store = await VibeDevStore.open(Path(tmp_dir) / "test.sqlite3")
    job_id = await store.create_job(
        title="Test",
        goal="Test gates",
        repo_root=repo_root,
        policies=policies or {},
    )
    return store, job_id


async def _eval(
    *,
    store: VibeDevStore,
    job_id: str,
    gates: list[dict],
    evidence: dict,
    acceptance_criteria: list[str] | None = None,
    step_id: str = "S1",
) -> list[str]:
    return await store._evaluate_step_gates(  # noqa: SLF001 (test)
        job_id=job_id,
        step={
            "step_id": step_id,
            "gates": gates,
            "acceptance_criteria": acceptance_criteria or [],
        },
        evidence=evidence,
    )


def _init_git_repo(repo_root: str) -> None:
    subprocess.run(["git", "init"], cwd=repo_root, check=True, capture_output=True)
    subprocess.run(
        ["git", "config", "user.email", "test@example.com"],
        cwd=repo_root,
        check=True,
        capture_output=True,
    )
    subprocess.run(
        ["git", "config", "user.name", "Test"],
        cwd=repo_root,
        check=True,
        capture_output=True,
    )


def _git_commit_all(repo_root: str, message: str) -> None:
    subprocess.run(["git", "add", "-A"], cwd=repo_root, check=True, capture_output=True)
    subprocess.run(
        ["git", "commit", "-m", message],
        cwd=repo_root,
        check=True,
        capture_output=True,
    )


@pytest.mark.asyncio
async def test_gate_tests_passed():
    tmp_dir = tempfile.mkdtemp()
    try:
        store, job_id = await _new_store_and_job(tmp_dir=tmp_dir, repo_root=None)
        try:
            failures = await _eval(
                store=store,
                job_id=job_id,
                gates=[{"type": "tests_passed", "parameters": {}}],
                evidence={"tests_passed": True, "tests_run": ["pytest -q"]},
            )
            assert failures == []

            failures = await _eval(
                store=store,
                job_id=job_id,
                gates=[{"type": "tests_passed", "parameters": {}}],
                evidence={"tests_passed": False, "tests_run": ["pytest -q"]},
            )
            assert any("tests_passed" in f for f in failures)
        finally:
            await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_gate_lint_passed():
    tmp_dir = tempfile.mkdtemp()
    try:
        store, job_id = await _new_store_and_job(tmp_dir=tmp_dir, repo_root=None)
        try:
            failures = await _eval(
                store=store,
                job_id=job_id,
                gates=[{"type": "lint_passed", "parameters": {}}],
                evidence={"lint_passed": True},
            )
            assert failures == []

            failures = await _eval(
                store=store,
                job_id=job_id,
                gates=[{"type": "lint_passed", "parameters": {}}],
                evidence={"lint_passed": False},
            )
            assert any("lint_passed" in f for f in failures)
        finally:
            await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_gate_criteria_checklist_complete():
    tmp_dir = tempfile.mkdtemp()
    try:
        store, job_id = await _new_store_and_job(tmp_dir=tmp_dir, repo_root=None)
        try:
            failures = await _eval(
                store=store,
                job_id=job_id,
                gates=[{"type": "criteria_checklist_complete", "parameters": {}}],
                evidence={"criteria_checklist": {"c1": True, "c2": True}},
                acceptance_criteria=["a", "b"],
            )
            assert failures == []

            failures = await _eval(
                store=store,
                job_id=job_id,
                gates=[{"type": "criteria_checklist_complete", "parameters": {}}],
                evidence={"criteria_checklist": {"c1": True}},
                acceptance_criteria=["a", "b"],
            )
            assert any("missing checklist keys" in f for f in failures)
        finally:
            await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_gate_changed_files_allowlist_and_forbid_paths():
    tmp_dir = tempfile.mkdtemp()
    try:
        store, job_id = await _new_store_and_job(tmp_dir=tmp_dir, repo_root=None)
        try:
            failures = await _eval(
                store=store,
                job_id=job_id,
                gates=[
                    {"type": "changed_files_allowlist", "parameters": {"allowed": ["src/**"]}},
                ],
                evidence={"changed_files": ["src/app.py", "src/lib/util.py"]},
            )
            assert failures == []

            failures = await _eval(
                store=store,
                job_id=job_id,
                gates=[
                    {"type": "changed_files_allowlist", "parameters": {"allowed": ["src/**"]}},
                ],
                evidence={"changed_files": ["tests/test_x.py"]},
            )
            assert any("allowlist" in f.lower() for f in failures)

            failures = await _eval(
                store=store,
                job_id=job_id,
                gates=[
                    {"type": "forbid_paths", "parameters": {"paths": ["secrets/**"]}},
                ],
                evidence={"changed_files": ["src/app.py"]},
            )
            assert failures == []

            failures = await _eval(
                store=store,
                job_id=job_id,
                gates=[
                    {"type": "forbid_paths", "parameters": {"paths": ["secrets/**"]}},
                ],
                evidence={"changed_files": ["secrets/key.txt"]},
            )
            assert any("forbidden" in f.lower() for f in failures)
        finally:
            await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_gate_changed_files_minimum():
    tmp_dir = tempfile.mkdtemp()
    try:
        store, job_id = await _new_store_and_job(tmp_dir=tmp_dir, repo_root=None)
        try:
            failures = await _eval(
                store=store,
                job_id=job_id,
                gates=[
                    {
                        "type": "changed_files_minimum",
                        "parameters": {"paths": ["src/**"], "min_count": 1},
                    }
                ],
                evidence={"changed_files": ["src/app.py"]},
            )
            assert failures == []

            failures = await _eval(
                store=store,
                job_id=job_id,
                gates=[
                    {
                        "type": "changed_files_minimum",
                        "parameters": {"paths": ["src/**"], "min_count": 2},
                    }
                ],
                evidence={"changed_files": ["src/app.py"]},
            )
            assert any("minimum" in f.lower() for f in failures)
        finally:
            await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_gate_file_exists_and_not_exists():
    tmp_dir = tempfile.mkdtemp()
    try:
        repo_root = os.path.join(tmp_dir, "repo")
        os.makedirs(repo_root)
        Path(repo_root, "present.txt").write_text("ok", encoding="utf-8")

        store, job_id = await _new_store_and_job(tmp_dir=tmp_dir, repo_root=repo_root)
        try:
            failures = await _eval(
                store=store,
                job_id=job_id,
                gates=[{"type": "file_exists", "parameters": {"path": "present.txt"}}],
                evidence={},
            )
            assert failures == []

            failures = await _eval(
                store=store,
                job_id=job_id,
                gates=[{"type": "file_exists", "parameters": {"path": "missing.txt"}}],
                evidence={},
            )
            assert any("does not exist" in f.lower() for f in failures)

            failures = await _eval(
                store=store,
                job_id=job_id,
                gates=[{"type": "file_not_exists", "parameters": {"path": "missing.txt"}}],
                evidence={},
            )
            assert failures == []

            failures = await _eval(
                store=store,
                job_id=job_id,
                gates=[{"type": "file_not_exists", "parameters": {"path": "present.txt"}}],
                evidence={},
            )
            assert any("should not exist" in f.lower() for f in failures)
        finally:
            await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_gate_no_uncommitted_changes_and_diff_bounds_and_patch_applies():
    tmp_dir = tempfile.mkdtemp()
    try:
        repo_root = os.path.join(tmp_dir, "repo")
        os.makedirs(repo_root)
        _init_git_repo(repo_root)

        Path(repo_root, "a.txt").write_text("one\n", encoding="utf-8")
        _git_commit_all(repo_root, "init")

        store, job_id = await _new_store_and_job(tmp_dir=tmp_dir, repo_root=repo_root)
        try:
            # Clean working tree.
            failures = await _eval(
                store=store,
                job_id=job_id,
                gates=[{"type": "no_uncommitted_changes", "parameters": {}}],
                evidence={},
            )
            assert failures == []

            # Create a change (unstaged).
            Path(repo_root, "a.txt").write_text("one\ntwo\n", encoding="utf-8")

            failures = await _eval(
                store=store,
                job_id=job_id,
                gates=[{"type": "no_uncommitted_changes", "parameters": {}}],
                evidence={},
            )
            assert any("not clean" in f.lower() for f in failures)

            # diff_min_lines should pass for >= 1 changed line.
            failures = await _eval(
                store=store,
                job_id=job_id,
                gates=[{"type": "diff_min_lines", "parameters": {"min": 1}}],
                evidence={},
            )
            assert failures == []

            # diff_max_lines should fail for very small max.
            failures = await _eval(
                store=store,
                job_id=job_id,
                gates=[{"type": "diff_max_lines", "parameters": {"max": 0}}],
                evidence={},
            )
            assert any("exceeds max" in f.lower() for f in failures)

            # patch_applies_cleanly should accept a real patch from git diff.
            patch = subprocess.run(
                ["git", "diff"],
                cwd=repo_root,
                check=True,
                capture_output=True,
                text=True,
            ).stdout
            failures = await _eval(
                store=store,
                job_id=job_id,
                gates=[{"type": "patch_applies_cleanly", "parameters": {"patch": patch}}],
                evidence={},
            )
            assert failures == []
        finally:
            await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_shell_command_gates_are_policy_guarded():
    tmp_dir = tempfile.mkdtemp()
    try:
        repo_root = os.path.join(tmp_dir, "repo")
        os.makedirs(repo_root)

        store, job_id = await _new_store_and_job(tmp_dir=tmp_dir, repo_root=repo_root, policies={})
        try:
            failures = await _eval(
                store=store,
                job_id=job_id,
                gates=[{"type": "command_exit_0", "parameters": {"command": "echo hi"}}],
                evidence={},
            )
            assert any("blocked by policy" in f.lower() for f in failures)
        finally:
            await store.close()

        store, job_id = await _new_store_and_job(
            tmp_dir=tmp_dir,
            repo_root=repo_root,
            policies={"enable_shell_gates": True, "shell_gate_allowlist": ["echo*"]},
        )
        try:
            failures = await _eval(
                store=store,
                job_id=job_id,
                gates=[{"type": "command_exit_0", "parameters": {"command": "echo hi"}}],
                evidence={},
            )
            assert failures == []

            failures = await _eval(
                store=store,
                job_id=job_id,
                gates=[
                    {
                        "type": "command_output_contains",
                        "parameters": {"command": "echo Hello", "contains": "hello", "case_insensitive": True},
                    }
                ],
                evidence={},
            )
            assert failures == []

            failures = await _eval(
                store=store,
                job_id=job_id,
                gates=[
                    {
                        "type": "command_output_regex",
                        "parameters": {"command": "echo abc123", "pattern": r"\\d+"},
                    }
                ],
                evidence={},
            )
            assert failures == []
        finally:
            await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_gate_json_schema_valid():
    tmp_dir = tempfile.mkdtemp()
    try:
        repo_root = os.path.join(tmp_dir, "repo")
        os.makedirs(repo_root)

        Path(repo_root, "data.json").write_text(json.dumps({"a": 1}), encoding="utf-8")

        store, job_id = await _new_store_and_job(tmp_dir=tmp_dir, repo_root=repo_root)
        try:
            failures = await _eval(
                store=store,
                job_id=job_id,
                gates=[
                    {
                        "type": "json_schema_valid",
                        "parameters": {"path": "data.json", "schema": {"type": "object", "required": ["a"]}},
                    }
                ],
                evidence={},
            )
            assert failures == []

            failures = await _eval(
                store=store,
                job_id=job_id,
                gates=[
                    {
                        "type": "json_schema_valid",
                        "parameters": {"path": "data.json", "schema": {"type": "object", "required": ["missing"]}},
                    }
                ],
                evidence={},
            )
            assert any("missing required properties" in f.lower() for f in failures)
        finally:
            await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_gate_human_approval_roundtrip():
    tmp_dir = tempfile.mkdtemp()
    try:
        repo_root = os.path.join(tmp_dir, "repo")
        os.makedirs(repo_root)

        store, job_id = await _new_store_and_job(tmp_dir=tmp_dir, repo_root=repo_root)
        try:
            # Create the step in DB so approval flag exists.
            await store.plan_set_deliverables(job_id, ["D"])
            await store.plan_set_invariants(job_id, [])
            await store.plan_set_definition_of_done(job_id, ["Done"])
            await store.plan_propose_steps(
                job_id,
                [
                    {
                        "title": "S1",
                        "instruction_prompt": "Do it",
                        "gates": [
                            {
                                "type": "human_approval",
                                "parameters": {"description": "Approve me"},
                            }
                        ],
                    }
                ],
            )

            failures = await _eval(
                store=store,
                job_id=job_id,
                gates=[
                    {"type": "human_approval", "parameters": {"description": "Approve me"}}
                ],
                evidence={},
                step_id="S1",
            )
            assert any("human_approval" in f for f in failures)

            await store.approve_step(job_id=job_id, step_id="S1")
            failures = await _eval(
                store=store,
                job_id=job_id,
                gates=[
                    {"type": "human_approval", "parameters": {"description": "Approve me"}}
                ],
                evidence={},
                step_id="S1",
            )
            assert failures == []

            await store.revoke_step_approval(job_id=job_id, step_id="S1")
            failures = await _eval(
                store=store,
                job_id=job_id,
                gates=[
                    {"type": "human_approval", "parameters": {"description": "Approve me"}}
                ],
                evidence={},
                step_id="S1",
            )
            assert any("human_approval" in f for f in failures)
        finally:
            await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_unknown_gate_type_fails():
    tmp_dir = tempfile.mkdtemp()
    try:
        store, job_id = await _new_store_and_job(tmp_dir=tmp_dir, repo_root=None)
        try:
            failures = await _eval(
                store=store,
                job_id=job_id,
                gates=[{"type": "not_a_real_gate", "parameters": {}}],
                evidence={},
            )
            assert any("Unknown gate type" in f for f in failures)
        finally:
            await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

