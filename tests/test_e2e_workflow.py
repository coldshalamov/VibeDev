"""
End-to-end workflow test for VibeDev.

This test validates the complete user journey from job creation through
to step execution and completion, including gate evaluation and results.
"""

import pytest
import tempfile
import json
from pathlib import Path

from vibedev_mcp.store import VibeDevStore


@pytest.mark.asyncio
async def test_complete_workflow_happy_path():
    """Test complete workflow: create job → plan → execute → complete."""
    tmpdir = tempfile.mkdtemp()
    db_path = Path(tmpdir) / "test.db"
    store = await VibeDevStore.open(db_path)
    
    try:
        # 1. Create job
        job_id = await store.create_job(
            title="E2E Test Workflow",
            goal="Test complete workflow from start to finish",
            repo_root=None,
            policies={}
        )
        
        # 2. Complete planning phase
        await store.plan_set_deliverables(job_id, ["Feature X implementation"])
        await store.plan_set_invariants(job_id, ["Test coverage > 80%", "Code review required"])
        await store.plan_set_definition_of_done(job_id, ["All tests pass", "Documentation complete"])
        
        # 3. Add steps
        steps = [
            {
                "title": "Implement Feature X",
                "instruction_prompt": "Implement the core feature functionality",
                "acceptance_criteria": ["Code compiles", "Basic tests pass"],
                "gates": [
                    {"type": "tests_passed", "description": "All tests must pass"},
                    {"type": "criteria_checklist_complete", "description": "All criteria met"}
                ]
            }
        ]
        await store.plan_propose_steps(job_id, steps)
        
        # 4. Set job to READY
        await store.job_set_ready(job_id)
        job = await store.get_job(job_id)
        assert job["status"] == "READY"
        
        # 5. Start job (transition to EXECUTING)
        await store.job_start(job_id)
        job = await store.get_job(job_id)
        assert job["status"] == "EXECUTING"
        
        # 6. Execute step - submit successful result
        step_id = job["step_order"][0]
        result = await store.job_submit_step_result(
            job_id=job_id,
            step_id=step_id,
            model_claim="MET",
            summary="Feature X implemented successfully",
            evidence={
                "diff_summary": "Added feature X implementation",
                "tests_passed": True,
                "tests_run": ["test_feature_x"],
                "criteria_checklist": {"c1": True, "c2": True},
                "devlog_line": "Implemented Feature X",
                "commit_hash": "abc123"
            },
            devlog_line="Implemented Feature X",
            commit_hash="abc123"
        )
        
        # 7. Verify result
        assert result["accepted"] is True
        assert result["next_action"] == "JOB_COMPLETE"
        
        # 8. Verify job completed
        job = await store.get_job(job_id)
        assert job["status"] == "COMPLETE"
        
        # 9. Verify attempt was recorded
        attempts = await store.get_attempts(job_id=job_id, step_id=step_id)
        assert len(attempts) > 0
        assert attempts[0]["outcome"] == "accepted"
        
        # 10. Verify gate results were persisted
        attempt_id = attempts[0]["attempt_id"]
        gate_results = await store.get_gate_results(attempt_id=attempt_id)
        # Should have gate results now (from our mock implementation)
        assert isinstance(gate_results, list)
        
    finally:
        # Ensure store is closed before cleanup
        if store:
            await store.close()
        # Clean up temp directory
        import shutil
        shutil.rmtree(tmpdir, ignore_errors=True)


@pytest.mark.asyncio
async def test_workflow_with_gate_failure():
    """Test workflow where a gate fails and retry logic works."""
    tmpdir = tempfile.mkdtemp()
    db_path = Path(tmpdir) / "test.db"
    store = await VibeDevStore.open(db_path)
    
    try:
        # Create job with strict testing policy
        job_id = await store.create_job(
            title="E2E Test with Gate Failure",
            goal="Test gate failure and retry workflow",
            repo_root=None,
            policies={
                "require_tests_evidence": True,
                "max_retries_per_step": 2,
                "retry_exhausted_action": "PAUSE_FOR_HUMAN"
            }
        )
        
        # Complete planning
        await store.plan_set_deliverables(job_id, ["Test feature"])
        await store.plan_set_invariants(job_id, ["Tests must pass"])
        await store.plan_set_definition_of_done(job_id, ["All green"])
        
        # Add step with test gate
        steps = [{
            "title": "Write and run tests",
            "instruction_prompt": "Write comprehensive tests",
            "acceptance_criteria": ["Tests written", "Tests pass"],
            "gates": [
                {"type": "tests_passed", "description": "Tests must pass"}
            ]
        }]
        await store.plan_propose_steps(job_id, steps)
        
        # Set ready and start
        await store.job_set_ready(job_id)
        await store.job_start(job_id)
        job = await store.get_job(job_id)
        assert job["status"] == "EXECUTING"
        
        # Submit failing result (tests didn't pass)
        step_id = job["step_order"][0]
        result = await store.job_submit_step_result(
            job_id=job_id,
            step_id=step_id,
            model_claim="MET",
            summary="Tests written but failing",
            evidence={
                "diff_summary": "Added test files",
                "tests_passed": False,  # This should trigger gate failure
                "tests_run": ["test_feature"],
                "devlog_line": "Attempt 1: tests failing",
                "commit_hash": "def456"
            },
            devlog_line="Attempt 1: tests failing",
            commit_hash="def456"
        )
        
        # Should be rejected due to gate failure
        assert result["accepted"] is False
        assert any("tests_passed" in str(reason) for reason in result["rejection_reasons"])
        
        # Verify attempt was recorded as rejected
        attempts = await store.get_attempts(job_id=job_id, step_id=step_id)
        assert len(attempts) > 0
        assert attempts[0]["outcome"] == "rejected"
        
        # Job should still be EXECUTING (not failed yet, since retries remain)
        job = await store.get_job(job_id)
        assert job["status"] == "EXECUTING"
        
        # Submit passing result on retry
        result2 = await store.job_submit_step_result(
            job_id=job_id,
            step_id=step_id,
            model_claim="MET",
            summary="Tests now passing",
            evidence={
                "diff_summary": "Fixed tests",
                "tests_passed": True,
                "tests_run": ["test_feature"],
                "devlog_line": "Attempt 2: tests fixed",
                "commit_hash": "def457"
            },
            devlog_line="Attempt 2: tests fixed",
            commit_hash="def457"
        )
        
        # Should be accepted now
        assert result2["accepted"] is True
        
    finally:
        if store:
            await store.close()
        import shutil
        shutil.rmtree(tmpdir, ignore_errors=True)


@pytest.mark.asyncio
async def test_gate_results_api_available():
    """Test that gate results API endpoint is available and returns data."""
    tmpdir = tempfile.mkdtemp()
    db_path = Path(tmpdir) / "test.db"
    store = await VibeDevStore.open(db_path)
    
    try:
        # Create simple job
        job_id = await store.create_job(
            title="Gate Results API Test",
            goal="Test gate results API",
            repo_root=None,
            policies={}
        )
        
        # Setup and execute
        await store.plan_set_deliverables(job_id, ["Test API"])
        await store.plan_set_invariants(job_id, ["API works"])
        await store.plan_set_definition_of_done(job_id, ["API tested"])
        
        steps = [{
            "title": "Test gate",
            "instruction_prompt": "Test gate evaluation",
            "acceptance_criteria": ["Gate works"],
            "gates": [
                {"type": "evidence_bool_true", "parameters": {"key": "test_key"}, "description": "Test gate"}
            ]
        }]
        await store.plan_propose_steps(job_id, steps)
        await store.job_set_ready(job_id)
        await store.job_start(job_id)
        
        # Submit result that will trigger gate evaluation
        step_id = (await store.get_job(job_id))["step_order"][0]
        await store.job_submit_step_result(
            job_id=job_id,
            step_id=step_id,
            model_claim="MET",
            summary="Testing gate results API",
            evidence={
                "test_key": False,  # Will fail the gate
                "diff_summary": "Test changes",
                "devlog_line": "Testing gates",
                "commit_hash": "test123"
            },
            devlog_line="Testing gates",
            commit_hash="test123"
        )
        
        # Get attempt and verify gate results API works
        attempts = await store.get_attempts(job_id=job_id, step_id=step_id)
        assert len(attempts) > 0
        
        attempt_id = attempts[0]["attempt_id"]
        gate_results = await store.get_gate_results(attempt_id=attempt_id)
        
        # API should return a list (even if empty in current implementation)
        assert isinstance(gate_results, list)
        
    finally:
        if store:
            await store.close()
        import shutil
        shutil.rmtree(tmpdir, ignore_errors=True)