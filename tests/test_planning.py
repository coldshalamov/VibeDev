"""Tests for job planning phase."""

import os
import shutil
import tempfile
import pytest


@pytest.mark.asyncio
async def test_job_set_ready_refuses_until_minimum_artifacts():
    """Test that job_set_ready refuses until all required artifacts are present."""
    from vibedev_mcp.store import VibeDevStore

    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "vibedev.sqlite3"))
        job_id = await store.create_job(
            title="T",
            goal="G",
            repo_root=None,
            policies={},
        )

        result = await store.job_set_ready(job_id)
        assert result["ready"] is False
        assert "deliverables" in result["missing"]
        assert "definition_of_done" in result["missing"]
        assert "steps" in result["missing"]
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_job_set_ready_succeeds_after_planning():
    """Test that job_set_ready succeeds after all planning artifacts are set."""
    from vibedev_mcp.store import VibeDevStore

    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "vibedev.sqlite3"))
        job_id = await store.create_job(
            title="T",
            goal="G",
            repo_root=None,
            policies={},
        )

        await store.plan_set_deliverables(job_id, ["Feature works", "Tests pass"])
        await store.plan_set_invariants(job_id, ["Patch-only edits"])
        await store.plan_set_definition_of_done(job_id, ["All steps accepted"])
        await store.plan_propose_steps(
            job_id,
            [
                {
                    "title": "Add skeleton",
                    "instruction_prompt": "Create the skeleton files.",
                    "acceptance_criteria": ["Files exist"],
                    "required_evidence": ["changed_files"],
                    "remediation_prompt": "If files missing, add them.",
                    "context_refs": [],
                }
            ],
        )

        result = await store.job_set_ready(job_id)
        assert result["ready"] is True
        assert result["job"]["status"] == "READY"
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
