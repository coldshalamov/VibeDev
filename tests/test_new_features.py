"""Tests for new VibeDev features.

Tests cover:
- Job lifecycle (pause, resume, fail)
- Job listing
- Plan refinement
- Devlog operations
- Git integration (mocked)
- Repo hygiene suggestions
- Conductor phase tracking
"""

import os
import shutil
import subprocess
import tempfile
import pytest


# =============================================================================
# Job Lifecycle Tests
# =============================================================================


@pytest.mark.asyncio
async def test_job_pause_and_resume():
    """Test pausing and resuming a job."""
    from vibedev_mcp.store import VibeDevStore

    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "vibedev.sqlite3"))
        job_id = await store.create_job(title="T", goal="G", repo_root=None, policies={})
        await store.plan_set_deliverables(job_id, ["D"])
        await store.plan_set_invariants(job_id, [])
        await store.plan_set_definition_of_done(job_id, ["Done"])
        await store.plan_propose_steps(
            job_id,
            [{"title": "Step", "instruction_prompt": "Do it"}],
        )
        await store.job_set_ready(job_id)
        await store.job_start(job_id)

        # Pause the job
        result = await store.job_pause(job_id)
        assert result["ok"] is True
        assert result["status"] == "PAUSED"

        job = await store.get_job(job_id)
        assert job["status"] == "PAUSED"

        # Resume the job
        result = await store.job_resume(job_id)
        assert result["ok"] is True
        assert result["status"] == "EXECUTING"

        job = await store.get_job(job_id)
        assert job["status"] == "EXECUTING"

        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_job_pause_requires_executing_status():
    """Test that pause fails for non-executing jobs."""
    from vibedev_mcp.store import VibeDevStore

    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "vibedev.sqlite3"))
        job_id = await store.create_job(title="T", goal="G", repo_root=None, policies={})

        with pytest.raises(ValueError, match="not EXECUTING"):
            await store.job_pause(job_id)

        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_job_fail_records_mistake():
    """Test that failing a job records a mistake entry."""
    from vibedev_mcp.store import VibeDevStore

    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "vibedev.sqlite3"))
        job_id = await store.create_job(title="T", goal="G", repo_root=None, policies={})
        await store.plan_set_deliverables(job_id, ["D"])
        await store.plan_set_invariants(job_id, [])
        await store.plan_set_definition_of_done(job_id, ["Done"])
        await store.plan_propose_steps(
            job_id,
            [{"title": "Step", "instruction_prompt": "Do it"}],
        )
        await store.job_set_ready(job_id)
        await store.job_start(job_id)

        # Fail the job
        result = await store.job_fail(job_id, "Test failure reason")
        assert result["ok"] is True
        assert result["status"] == "FAILED"
        assert result["reason"] == "Test failure reason"

        job = await store.get_job(job_id)
        assert job["status"] == "FAILED"

        # Check mistake was recorded
        mistakes = await store.mistake_list(job_id=job_id)
        assert len(mistakes) == 1
        assert mistakes[0]["title"] == "Job Failed"
        # Note: mistake_list returns title, lesson, avoid_next_time, not what_happened
        assert "failure" in mistakes[0]["lesson"].lower() or "job_failure" in mistakes[0].get("tags", [])

        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_job_list_all():
    """Test listing all jobs."""
    from vibedev_mcp.store import VibeDevStore

    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "vibedev.sqlite3"))

        # Create multiple jobs
        job1 = await store.create_job(title="Job 1", goal="Goal 1", repo_root=None, policies={})
        job2 = await store.create_job(title="Job 2", goal="Goal 2", repo_root=None, policies={})
        job3 = await store.create_job(title="Job 3", goal="Goal 3", repo_root=None, policies={})

        result = await store.job_list()
        assert result["count"] == 3
        job_ids = {j["job_id"] for j in result["items"]}
        assert job1 in job_ids
        assert job2 in job_ids
        assert job3 in job_ids

        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_job_list_with_status_filter():
    """Test listing jobs with status filter."""
    from vibedev_mcp.store import VibeDevStore

    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "vibedev.sqlite3"))

        # Create jobs with different statuses
        job1 = await store.create_job(title="Planning", goal="G", repo_root=None, policies={})

        job2 = await store.create_job(title="Ready", goal="G", repo_root=None, policies={})
        await store.plan_set_deliverables(job2, ["D"])
        await store.plan_set_invariants(job2, [])
        await store.plan_set_definition_of_done(job2, ["Done"])
        await store.plan_propose_steps(job2, [{"title": "S", "instruction_prompt": "I"}])
        await store.job_set_ready(job2)

        # Filter by PLANNING
        result = await store.job_list(status="PLANNING")
        assert result["count"] == 1
        assert result["items"][0]["job_id"] == job1

        # Filter by READY
        result = await store.job_list(status="READY")
        assert result["count"] == 1
        assert result["items"][0]["job_id"] == job2

        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


# =============================================================================
# Plan Refinement Tests
# =============================================================================


@pytest.mark.asyncio
async def test_plan_refine_steps_update():
    """Test updating a step via refinement."""
    from vibedev_mcp.store import VibeDevStore

    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "vibedev.sqlite3"))
        job_id = await store.create_job(title="T", goal="G", repo_root=None, policies={})
        await store.plan_propose_steps(
            job_id,
            [
                {"title": "Original", "instruction_prompt": "Original prompt"},
                {"title": "Second", "instruction_prompt": "Second prompt"},
            ],
        )

        # Update step S1
        result = await store.plan_refine_steps(
            job_id,
            [
                {
                    "step_id": "S1",
                    "action": "update",
                    "data": {"title": "Updated", "instruction_prompt": "Updated prompt"},
                }
            ],
        )

        assert len(result) == 2
        assert result[0]["title"] == "Updated"
        assert result[0]["instruction_prompt"] == "Updated prompt"
        assert result[1]["title"] == "Second"

        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_plan_refine_steps_insert():
    """Test inserting a step via refinement."""
    from vibedev_mcp.store import VibeDevStore

    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "vibedev.sqlite3"))
        job_id = await store.create_job(title="T", goal="G", repo_root=None, policies={})
        await store.plan_propose_steps(
            job_id,
            [{"title": "First", "instruction_prompt": "First prompt"}],
        )

        # Insert after S1
        result = await store.plan_refine_steps(
            job_id,
            [
                {
                    "step_id": "S1",
                    "action": "insert_after",
                    "data": {"title": "Inserted", "instruction_prompt": "Inserted prompt"},
                }
            ],
        )

        assert len(result) == 2
        assert result[0]["title"] == "First"
        assert result[1]["title"] == "Inserted"

        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_plan_refine_steps_delete():
    """Test deleting a step via refinement."""
    from vibedev_mcp.store import VibeDevStore

    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "vibedev.sqlite3"))
        job_id = await store.create_job(title="T", goal="G", repo_root=None, policies={})
        await store.plan_propose_steps(
            job_id,
            [
                {"title": "First", "instruction_prompt": "First prompt"},
                {"title": "Second", "instruction_prompt": "Second prompt"},
                {"title": "Third", "instruction_prompt": "Third prompt"},
            ],
        )

        # Delete S2
        result = await store.plan_refine_steps(
            job_id,
            [{"step_id": "S2", "action": "delete", "data": {}}],
        )

        assert len(result) == 2
        assert result[0]["title"] == "First"
        assert result[1]["title"] == "Third"

        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


# =============================================================================
# Devlog Tests
# =============================================================================


@pytest.mark.asyncio
async def test_devlog_list():
    """Test listing devlog entries."""
    from vibedev_mcp.store import VibeDevStore

    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "vibedev.sqlite3"))
        job_id = await store.create_job(title="T", goal="G", repo_root=None, policies={})

        await store.devlog_append(job_id=job_id, content="Entry 1", log_type="DEVLOG")
        await store.devlog_append(job_id=job_id, content="Entry 2", log_type="DECISION")
        await store.devlog_append(job_id=job_id, content="Entry 3", log_type="DEVLOG")

        # List all
        entries = await store.devlog_list(job_id=job_id)
        assert len(entries) == 3

        # Filter by type
        devlogs = await store.devlog_list(job_id=job_id, log_type="DEVLOG")
        assert len(devlogs) == 2

        decisions = await store.devlog_list(job_id=job_id, log_type="DECISION")
        assert len(decisions) == 1

        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_devlog_export_markdown():
    """Test exporting devlog as markdown."""
    from vibedev_mcp.store import VibeDevStore

    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "vibedev.sqlite3"))
        job_id = await store.create_job(title="Test Job", goal="G", repo_root=None, policies={})

        await store.devlog_append(job_id=job_id, content="First entry")
        await store.devlog_append(job_id=job_id, content="Second entry", step_id="S1")

        result = await store.devlog_export(job_id=job_id, format="md")
        assert result["format"] == "md"
        assert "# Dev Log: Test Job" in result["content"]
        assert "First entry" in result["content"]
        assert "[S1]" in result["content"]

        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_devlog_export_json():
    """Test exporting devlog as JSON."""
    from vibedev_mcp.store import VibeDevStore

    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "vibedev.sqlite3"))
        job_id = await store.create_job(title="T", goal="G", repo_root=None, policies={})

        await store.devlog_append(job_id=job_id, content="Entry")

        result = await store.devlog_export(job_id=job_id, format="json")
        assert result["format"] == "json"
        assert len(result["entries"]) == 1

        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


# =============================================================================
# Conductor Phase Tests
# =============================================================================


def test_conductor_get_current_phase():
    """Test phase detection."""
    from vibedev_mcp.conductor import get_current_phase, PlanningPhase

    # Empty job -> Phase 1
    job = {"planning_answers": {}}
    assert get_current_phase(job) == PlanningPhase.INTENT_SCOPE

    # Phase 1 complete -> Phase 2
    job = {
        "planning_answers": {
            "repo_exists": False,
            "out_of_scope": [],
            "target_environment": {"os": "Windows"},
            "timeline_priority": "MVP",
        },
        "deliverables": [],
        "definition_of_done": [],
    }
    assert get_current_phase(job) == PlanningPhase.DELIVERABLES

    # Phase 2 complete -> Phase 3
    job["deliverables"] = ["D"]
    job["definition_of_done"] = ["Done"]
    assert get_current_phase(job) == PlanningPhase.INVARIANTS

    # Phase 3 complete (no repo) -> Phase 5
    job["invariants"] = []
    assert get_current_phase(job) == PlanningPhase.PLAN_COMPILATION

    # With repo -> Phase 4
    job["planning_answers"]["repo_exists"] = True
    assert get_current_phase(job) == PlanningPhase.REPO_CONTEXT

    # Phase 4 complete -> Phase 5
    job["repo_root"] = "/some/path"
    assert get_current_phase(job) == PlanningPhase.PLAN_COMPILATION

    # Phase 5 complete -> COMPLETE
    job["step_order"] = ["S1"]
    assert get_current_phase(job) == PlanningPhase.COMPLETE


def test_conductor_validate_ready_transition():
    """Test ready transition validation."""
    from vibedev_mcp.conductor import validate_ready_transition

    # Incomplete job
    job = {"planning_answers": {}}
    is_ready, missing = validate_ready_transition(job)
    assert is_ready is False
    assert len(missing) > 0

    # Complete job
    job = {
        "planning_answers": {
            "repo_exists": False,
            "out_of_scope": [],
            "target_environment": {},
            "timeline_priority": "MVP",
        },
        "deliverables": ["D"],
        "definition_of_done": ["Done"],
        "invariants": [],
        "step_order": ["S1"],
    }
    is_ready, missing = validate_ready_transition(job)
    assert is_ready is True
    assert len(missing) == 0


def test_conductor_get_phase_summary():
    """Test phase summary generation."""
    from vibedev_mcp.conductor import get_phase_summary

    job = {
        "planning_answers": {
            "repo_exists": True,
            "out_of_scope": [],
            "target_environment": {},
            "timeline_priority": "MVP",
        },
        "deliverables": ["D"],
        "definition_of_done": ["Done"],
        "invariants": [],
        "repo_root": "/path",
        "step_order": ["S1", "S2"],
    }

    summary = get_phase_summary(job)
    assert summary["is_complete"] is True
    assert summary["current_phase_name"] == "COMPLETE"
    assert summary["has_repo"] is True
    assert summary["step_count"] == 2


# =============================================================================
# Git Integration Tests (mock-based)
# =============================================================================


@pytest.mark.asyncio
async def test_git_status_no_repo():
    """Test git_status fails without repo_root."""
    from vibedev_mcp.store import VibeDevStore

    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "vibedev.sqlite3"))
        job_id = await store.create_job(title="T", goal="G", repo_root=None, policies={})

        with pytest.raises(ValueError, match="no repo_root"):
            await store.git_status(job_id=job_id)

        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_git_status_with_repo():
    """Test git_status on a real git repo."""
    from vibedev_mcp.store import VibeDevStore

    tmp_dir = tempfile.mkdtemp()
    try:
        # Create a minimal git repo
        repo_dir = os.path.join(tmp_dir, "repo")
        os.makedirs(repo_dir)
        subprocess.run(["git", "init", "-q"], cwd=repo_dir, check=True)
        with open(os.path.join(repo_dir, "test.txt"), "w") as f:
            f.write("test")

        store = await VibeDevStore.open(os.path.join(tmp_dir, "vibedev.sqlite3"))
        job_id = await store.create_job(title="T", goal="G", repo_root=repo_dir, policies={})

        result = await store.git_status(job_id=job_id)
        assert result["ok"] is True
        # New file should show up
        assert "test.txt" in result.get("added", []) or "??" in result.get("raw", "")

        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


# =============================================================================
# Repo Hygiene Tests
# =============================================================================


@pytest.mark.asyncio
async def test_repo_hygiene_suggest():
    """Test repo hygiene suggestions."""
    from vibedev_mcp.store import VibeDevStore

    tmp_dir = tempfile.mkdtemp()
    try:
        # Create repo with stale files
        repo_dir = os.path.join(tmp_dir, "repo")
        os.makedirs(repo_dir)
        with open(os.path.join(repo_dir, "main.py"), "w") as f:
            f.write("# main")
        with open(os.path.join(repo_dir, "main.py.bak"), "w") as f:
            f.write("# backup")
        with open(os.path.join(repo_dir, "old_config.py"), "w") as f:
            f.write("# old")

        store = await VibeDevStore.open(os.path.join(tmp_dir, "vibedev.sqlite3"))
        job_id = await store.create_job(title="T", goal="G", repo_root=repo_dir, policies={})

        result = await store.repo_hygiene_suggest(job_id=job_id)
        assert result["count"] >= 2  # At least the .bak and old_ files

        # Check that stale files are suggested
        stale_paths = [s["path"] for s in result["suggestions"] if s["type"] == "stale_file"]
        assert any("bak" in p for p in stale_paths)
        assert any("old" in p for p in stale_paths)

        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


# =============================================================================
# MCP Tool Registration Tests
# =============================================================================


@pytest.mark.asyncio
async def test_mcp_server_registers_new_tools():
    """Test that new tools are registered."""
    from vibedev_mcp.server import mcp

    tools = await mcp.list_tools()
    names = {t.name for t in tools}

    # New lifecycle tools
    assert "job_pause" in names
    assert "job_resume" in names
    assert "job_fail" in names
    assert "job_list" in names

    # Plan refinement
    assert "plan_refine_steps" in names

    # Devlog tools
    assert "devlog_list" in names
    assert "devlog_export" in names

    # Git tools
    assert "git_status" in names
    assert "git_diff_summary" in names
    assert "git_log" in names

    # Repo hygiene
    assert "repo_hygiene_suggest" in names
