"""Tests for job execution flow."""

import os
import shutil
import tempfile
import pytest


@pytest.mark.asyncio
async def test_job_execution_step_prompt_and_submission_gating():
    """Test execution step prompt generation and submission gating."""
    from vibedev_mcp.store import VibeDevStore

    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "vibedev.sqlite3"))
        job_id = await store.create_job(title="T", goal="G", repo_root=None, policies={})
        await store.plan_set_deliverables(job_id, ["D"])
        await store.plan_set_invariants(job_id, [])
        await store.plan_set_definition_of_done(job_id, ["Do it"])
        await store.plan_propose_steps(
            job_id,
            [
                {
                    "title": "One step",
                    "instruction_prompt": "Do the thing.",
                    "acceptance_criteria": ["Works"],
                    "required_evidence": ["changed_files"],
                    "remediation_prompt": "Fix it.",
                    "context_refs": [],
                }
            ],
        )
        ready = await store.job_set_ready(job_id)
        assert ready["ready"] is True

        await store.job_start(job_id)
        step_prompt = await store.job_next_step_prompt(job_id)
        assert step_prompt["step_id"] == "S1"
        assert "required_evidence" in step_prompt
        assert "changed_files" in step_prompt["required_evidence"]["required"]
        assert "required_evidence_template" in step_prompt
        assert "changed_files" in step_prompt["required_evidence_template"]
        assert "criteria_checklist" in step_prompt["required_evidence_template"]
        assert step_prompt["prompt"].find("1) Step Objective") < step_prompt["prompt"].find(
            "2) Non-Negotiable Invariants"
        )

        rejected = await store.job_submit_step_result(
            job_id=job_id,
            step_id="S1",
            model_claim="MET",
            summary="done",
            evidence={},
            devlog_line=None,
            commit_hash=None,
        )
        assert rejected["accepted"] is False
        assert "changed_files" in rejected["missing_fields"]

        accepted = await store.job_submit_step_result(
            job_id=job_id,
            step_id="S1",
            model_claim="MET",
            summary="done",
            evidence={"changed_files": ["x.py"]},
            devlog_line="did stuff",
            commit_hash=None,
        )
        assert accepted["accepted"] is True
        assert accepted["next_action"] == "JOB_COMPLETE"
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_policy_require_devlog_rejects_missing_devlog():
    """Test that require_devlog_per_step policy rejects missing devlog."""
    from vibedev_mcp.store import VibeDevStore

    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "vibedev.sqlite3"))
        job_id = await store.create_job(
            title="T",
            goal="G",
            repo_root=None,
            policies={"require_devlog_per_step": True},
        )
        await store.plan_set_deliverables(job_id, ["D"])
        await store.plan_set_invariants(job_id, [])
        await store.plan_set_definition_of_done(job_id, ["Do it"])
        await store.plan_propose_steps(
            job_id,
            [
                {
                    "title": "One step",
                    "instruction_prompt": "Do the thing.",
                    "acceptance_criteria": ["Works"],
                    "required_evidence": ["changed_files"],
                    "remediation_prompt": "Fix it.",
                    "context_refs": [],
                }
            ],
        )
        await store.job_set_ready(job_id)
        await store.job_start(job_id)

        res = await store.job_submit_step_result(
            job_id=job_id,
            step_id="S1",
            model_claim="MET",
            summary="done",
            evidence={"changed_files": ["x.py"]},
            devlog_line=None,
            commit_hash=None,
        )
        assert res["accepted"] is False
        assert "devlog_line" in res["missing_fields"]
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_policy_strict_evidence_requires_tests_diff_and_criteria_checklist():
    """Strict evidence mode should enforce tests/diff evidence and per-criterion checklist."""
    from vibedev_mcp.store import VibeDevStore

    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "vibedev.sqlite3"))
        job_id = await store.create_job(
            title="T",
            goal="G",
            repo_root=None,
            policies={
                "require_tests_evidence": True,
                "require_diff_summary": True,
                "evidence_schema_mode": "strict",
            },
        )
        await store.plan_set_deliverables(job_id, ["D"])
        await store.plan_set_invariants(job_id, [])
        await store.plan_set_definition_of_done(job_id, ["Do it"])
        await store.plan_propose_steps(
            job_id,
            [
                {
                    "title": "One step",
                    "instruction_prompt": "Do the thing.",
                    "acceptance_criteria": ["Works", "No regressions"],
                    "required_evidence": ["changed_files"],
                    "remediation_prompt": "Fix it.",
                    "context_refs": [],
                }
            ],
        )
        await store.job_set_ready(job_id)
        await store.job_start(job_id)

        res = await store.job_submit_step_result(
            job_id=job_id,
            step_id="S1",
            model_claim="MET",
            summary="done",
            evidence={"changed_files": ["x.py"]},
            devlog_line="did stuff",
            commit_hash=None,
        )
        assert res["accepted"] is False
        assert "diff_summary" in res["missing_fields"]
        assert "tests_run" in res["missing_fields"]
        assert "tests_passed" in res["missing_fields"]
        assert "criteria_checklist" in res["missing_fields"]
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
