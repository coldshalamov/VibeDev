"""Comprehensive tests for VibeDevStore to achieve 80%+ coverage.

Tests cover:
- Job lifecycle (create, get, archive)
- Context blocks (add, get, search)
- Devlog operations
- Mistake ledger
- Repo snapshot
- Export bundle

Uses manual temp directory management to avoid Windows file locking issues.
"""

import os
import shutil
import tempfile
import pytest


@pytest.mark.asyncio
async def test_store_creates_and_reads_job():
    """Test basic job creation and retrieval."""
    from vibedev_mcp.store import VibeDevStore

    tmp_dir = tempfile.mkdtemp()
    try:
        db_path = os.path.join(tmp_dir, "vibedev.sqlite3")
        store = await VibeDevStore.open(db_path)

        job_id = await store.create_job(
            title="Test job",
            goal="Ship a feature",
            repo_root=None,
            policies={},
        )

        job = await store.get_job(job_id)
        assert job["job_id"] == job_id
        assert job["status"] == "PLANNING"
        assert job["title"] == "Test job"
        assert job["goal"] == "Ship a feature"
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_store_get_job_raises_for_missing():
    """Test that get_job raises KeyError for non-existent job."""
    from vibedev_mcp.store import VibeDevStore

    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "vibedev.sqlite3"))
        with pytest.raises(KeyError):
            await store.get_job("NONEXISTENT")
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_conductor_merge_answers():
    """Test merging answers during planning phase."""
    from vibedev_mcp.store import VibeDevStore

    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "vibedev.sqlite3"))
        job_id = await store.create_job(
            title="T", goal="G", repo_root=None, policies={}
        )

        await store.conductor_merge_answers(
            job_id, {"why": "Testing", "what": "Feature X"}
        )

        job = await store.get_job(job_id)
        assert job["planning_answers"]["why"] == "Testing"
        assert job["planning_answers"]["what"] == "Feature X"

        # Merge more answers
        await store.conductor_merge_answers(job_id, {"when": "Now"})
        job = await store.get_job(job_id)
        assert job["planning_answers"]["when"] == "Now"
        assert job["planning_answers"]["why"] == "Testing"
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_context_add_and_get_block():
    """Test adding and retrieving context blocks."""
    from vibedev_mcp.store import VibeDevStore

    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "vibedev.sqlite3"))
        job_id = await store.create_job(
            title="T", goal="G", repo_root=None, policies={}
        )

        context_id = await store.context_add_block(
            job_id=job_id,
            block_type="RESEARCH",
            content="Found relevant docs at example.com",
            tags=["docs", "api"],
        )

        assert context_id is not None
        assert context_id.startswith("CTX")

        block = await store.context_get_block(job_id=job_id, context_id=context_id)
        assert block is not None
        assert block["block_type"] == "RESEARCH"
        assert "example.com" in block["content"]
        assert "docs" in block["tags"]
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_context_get_block_raises_for_missing():
    """Test that context_get_block raises KeyError for non-existent block."""
    from vibedev_mcp.store import VibeDevStore

    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "vibedev.sqlite3"))
        job_id = await store.create_job(
            title="T", goal="G", repo_root=None, policies={}
        )

        with pytest.raises(KeyError):
            await store.context_get_block(job_id=job_id, context_id="CTX-XXXX")
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_context_search():
    """Test searching context blocks by content."""
    from vibedev_mcp.store import VibeDevStore

    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "vibedev.sqlite3"))
        job_id = await store.create_job(
            title="T", goal="G", repo_root=None, policies={}
        )

        await store.context_add_block(
            job_id=job_id,
            block_type="RESEARCH",
            content="Authentication uses OAuth2",
            tags=["auth"],
        )
        await store.context_add_block(
            job_id=job_id,
            block_type="NOTE",
            content="Database uses PostgreSQL",
            tags=["db"],
        )
        await store.context_add_block(
            job_id=job_id,
            block_type="RESEARCH",
            content="OAuth2 refresh tokens expire",
            tags=["auth", "tokens"],
        )

        results = await store.context_search(job_id=job_id, query="OAuth2")
        assert len(results) >= 2
        # context_search returns 'excerpt', not 'content'
        assert all("OAuth2" in r["excerpt"] for r in results)
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_devlog_append():
    """Test appending to devlog."""
    from vibedev_mcp.store import VibeDevStore

    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "vibedev.sqlite3"))
        job_id = await store.create_job(
            title="T", goal="G", repo_root=None, policies={}
        )

        log_id = await store.devlog_append(
            job_id=job_id,
            content="Started working on feature X",
            step_id=None,
            commit_hash=None,
            log_type="DEVLOG",
        )

        assert log_id is not None

        log_id_2 = await store.devlog_append(
            job_id=job_id,
            content="Completed step 1",
            step_id="S1",
            commit_hash="abc123",
            log_type="PROGRESS",
        )

        assert log_id_2 is not None
        assert log_id != log_id_2
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_mistake_record_and_list():
    """Test recording and listing mistakes."""
    from vibedev_mcp.store import VibeDevStore

    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "vibedev.sqlite3"))
        job_id = await store.create_job(
            title="T", goal="G", repo_root=None, policies={}
        )

        mistake_id = await store.mistake_record(
            job_id=job_id,
            title="Forgot to run tests",
            what_happened="Pushed code without running tests",
            why="Was rushing to finish",
            lesson="Always run tests before committing",
            avoid_next_time="Add pre-commit hook",
            tags=["testing", "process"],
            related_step_id=None,
        )

        assert mistake_id is not None
        assert mistake_id.startswith("MSK")

        await store.mistake_record(
            job_id=job_id,
            title="Wrong file edited",
            what_happened="Edited config.py instead of settings.py",
            why="Similar names",
            lesson="Double-check file path",
            avoid_next_time="Use IDE search",
            tags=["files"],
            related_step_id="S1",
        )

        mistakes = await store.mistake_list(job_id=job_id)
        assert len(mistakes) == 2
        assert any(m["title"] == "Forgot to run tests" for m in mistakes)
        assert any(m["title"] == "Wrong file edited" for m in mistakes)
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_repo_snapshot():
    """Test creating a repo snapshot."""
    from vibedev_mcp.store import VibeDevStore

    tmp_dir = tempfile.mkdtemp()
    try:
        # Create a mock repo structure
        repo_root = os.path.join(tmp_dir, "repo")
        os.makedirs(os.path.join(repo_root, "src"))
        with open(os.path.join(repo_root, "src", "main.py"), "w") as f:
            f.write("print('hello')")
        os.makedirs(os.path.join(repo_root, "tests"))
        with open(os.path.join(repo_root, "tests", "test_main.py"), "w") as f:
            f.write("def test_it(): pass")
        with open(os.path.join(repo_root, "README.md"), "w") as f:
            f.write("# Project")

        store = await VibeDevStore.open(os.path.join(tmp_dir, "vibedev.sqlite3"))
        job_id = await store.create_job(
            title="T", goal="G", repo_root=repo_root, policies={}
        )

        snapshot = await store.repo_snapshot(
            job_id=job_id,
            repo_root=repo_root,
            notes="Initial state",
        )

        assert snapshot is not None
        assert "snapshot_id" in snapshot
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_job_archive():
    """Test archiving a job (returns None but updates status)."""
    from vibedev_mcp.store import VibeDevStore

    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "vibedev.sqlite3"))
        job_id = await store.create_job(
            title="T", goal="G", repo_root=None, policies={}
        )

        # job_archive returns None
        result = await store.job_archive(job_id=job_id)
        assert result is None

        job = await store.get_job(job_id)
        assert job["status"] == "ARCHIVED"
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_job_export_bundle_json():
    """Test exporting job as JSON bundle."""
    from vibedev_mcp.store import VibeDevStore

    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "vibedev.sqlite3"))
        job_id = await store.create_job(
            title="Test Export",
            goal="Export job data",
            repo_root=None,
            policies={"test_policy": True},
        )

        await store.plan_set_deliverables(job_id, ["Feature complete"])
        await store.context_add_block(
            job_id=job_id,
            block_type="NOTE",
            content="Some context",
            tags=["test"],
        )

        bundle = await store.job_export_bundle(job_id=job_id, format="json")

        assert bundle is not None
        assert "job" in bundle
        assert bundle["job"]["title"] == "Test Export"
        # Bundle contains 'steps', not 'context_blocks'
        assert "steps" in bundle
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_plan_set_deliverables():
    """Test setting deliverables."""
    from vibedev_mcp.store import VibeDevStore

    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "vibedev.sqlite3"))
        job_id = await store.create_job(
            title="T", goal="G", repo_root=None, policies={}
        )

        await store.plan_set_deliverables(job_id, ["Feature A", "Feature B"])

        job = await store.get_job(job_id)
        assert job["deliverables"] == ["Feature A", "Feature B"]
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_plan_set_invariants():
    """Test setting invariants."""
    from vibedev_mcp.store import VibeDevStore

    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "vibedev.sqlite3"))
        job_id = await store.create_job(
            title="T", goal="G", repo_root=None, policies={}
        )

        await store.plan_set_invariants(job_id, ["No breaking changes", "Keep backward compat"])

        job = await store.get_job(job_id)
        assert "No breaking changes" in job["invariants"]
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_plan_set_definition_of_done():
    """Test setting definition of done."""
    from vibedev_mcp.store import VibeDevStore

    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "vibedev.sqlite3"))
        job_id = await store.create_job(
            title="T", goal="G", repo_root=None, policies={}
        )

        await store.plan_set_definition_of_done(job_id, ["All tests pass", "Docs updated"])

        job = await store.get_job(job_id)
        assert job["definition_of_done"] == ["All tests pass", "Docs updated"]
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_plan_propose_steps_with_missing_fields():
    """Test step proposal works with minimal data."""
    from vibedev_mcp.store import VibeDevStore

    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "vibedev.sqlite3"))
        job_id = await store.create_job(
            title="T", goal="G", repo_root=None, policies={}
        )

        # Minimal step with only required fields
        result = await store.plan_propose_steps(
            job_id,
            [{"title": "Step 1", "instruction_prompt": "Do something"}],
        )
        assert len(result) == 1
        assert result[0]["title"] == "Step 1"
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_multiple_steps_execution():
    """Test executing multiple steps in sequence."""
    from vibedev_mcp.store import VibeDevStore

    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "vibedev.sqlite3"))
        job_id = await store.create_job(
            title="Multi-step",
            goal="Test multi-step execution",
            repo_root=None,
            policies={},
        )

        await store.plan_set_deliverables(job_id, ["D"])
        await store.plan_set_invariants(job_id, [])
        await store.plan_set_definition_of_done(job_id, ["All steps done"])
        await store.plan_propose_steps(
            job_id,
            [
                {
                    "title": "Step 1",
                    "instruction_prompt": "First step",
                    "acceptance_criteria": ["Done"],
                    "required_evidence": ["changed_files"],
                    "remediation_prompt": "Fix",
                    "context_refs": [],
                },
                {
                    "title": "Step 2",
                    "instruction_prompt": "Second step",
                    "acceptance_criteria": ["Done"],
                    "required_evidence": ["test_output"],
                    "remediation_prompt": "Fix",
                    "context_refs": [],
                },
            ],
        )

        await store.job_set_ready(job_id)
        await store.job_start(job_id)

        # First step
        prompt = await store.job_next_step_prompt(job_id)
        assert prompt["step_id"] == "S1"

        result = await store.job_submit_step_result(
            job_id=job_id,
            step_id="S1",
            model_claim="MET",
            summary="done",
            evidence={"changed_files": ["a.py"]},
            devlog_line="step 1",
            commit_hash=None,
        )
        assert result["accepted"] is True
        assert result["next_action"] == "NEXT_STEP_AVAILABLE"

        # Second step
        prompt2 = await store.job_next_step_prompt(job_id)
        assert prompt2["step_id"] == "S2"

        result2 = await store.job_submit_step_result(
            job_id=job_id,
            step_id="S2",
            model_claim="MET",
            summary="done",
            evidence={"test_output": "all passed"},
            devlog_line="step 2",
            commit_hash=None,
        )
        assert result2["accepted"] is True
        assert result2["next_action"] == "JOB_COMPLETE"
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_not_met_claim_is_rejected():
    """Test that NOT_MET claim results in rejection."""
    from vibedev_mcp.store import VibeDevStore

    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "vibedev.sqlite3"))
        job_id = await store.create_job(
            title="T", goal="G", repo_root=None, policies={}
        )

        await store.plan_set_deliverables(job_id, ["D"])
        await store.plan_set_invariants(job_id, [])
        await store.plan_set_definition_of_done(job_id, ["Done"])
        await store.plan_propose_steps(
            job_id,
            [
                {
                    "title": "Step",
                    "instruction_prompt": "Do it",
                    "acceptance_criteria": ["Works"],
                    "required_evidence": ["changed_files"],
                    "remediation_prompt": "Try again",
                    "context_refs": [],
                }
            ],
        )

        await store.job_set_ready(job_id)
        await store.job_start(job_id)

        result = await store.job_submit_step_result(
            job_id=job_id,
            step_id="S1",
            model_claim="NOT_MET",
            summary="Could not complete",
            evidence={"changed_files": []},
            devlog_line="failed",
            commit_hash=None,
        )

        # NOT_MET with valid evidence is still rejected
        assert result["accepted"] is False
        assert "Model claim is not MET." in result["rejection_reasons"]
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_job_export_bundle_markdown():
    """Test exporting job as Markdown bundle."""
    from vibedev_mcp.store import VibeDevStore

    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "vibedev.sqlite3"))
        job_id = await store.create_job(
            title="MD Export Test",
            goal="Test markdown export",
            repo_root=None,
            policies={},
        )

        await store.plan_set_deliverables(job_id, ["Feature done"])
        await store.plan_set_invariants(job_id, [])
        await store.plan_set_definition_of_done(job_id, ["Done"])
        await store.plan_propose_steps(
            job_id,
            [{"title": "Step 1", "instruction_prompt": "Do the thing"}],
        )

        bundle = await store.job_export_bundle(job_id=job_id, format="md")

        assert bundle["format"] == "md"
        assert "# MD Export Test" in bundle["content"]
        assert "## Goal" in bundle["content"]
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
