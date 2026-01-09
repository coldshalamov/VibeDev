"""Tests for checkpoint injection logic."""

import os
import shutil
import tempfile
import pytest

@pytest.mark.asyncio
async def test_checkpoint_injection():
    """Test that plan_propose_steps injects checkpoints based on policy."""
    from vibedev_mcp.store import VibeDevStore

    tmp_dir = tempfile.mkdtemp()
    try:
        # Initialize store
        store = await VibeDevStore.open(os.path.join(tmp_dir, "vibedev.sqlite3"))
        
        # 1. Create job with checkpoint_interval_steps = 2
        job_id = await store.create_job(
            title="Checkpoint Test Job",
            goal="Test checkpoints",
            repo_root=None,
            policies={"checkpoint_interval_steps": 2},
        )

        # 2. Propose 5 steps
        steps = []
        for i in range(5):
            steps.append({
                "title": f"Step {i+1}",
                "instruction_prompt": f"Do step {i+1}",
                "acceptance_criteria": [],
                "required_evidence": [],
            })

        await store.plan_propose_steps(job_id, steps)

        # 3. Verify total steps
        # Expected order:
        # 1. Step 1 (exec count 1)
        # 2. Step 2 (exec count 2) -> Trigger Checkpoint 1
        # 3. Checkpoint 1
        # 4. Step 3 (exec count 3)
        # 5. Step 4 (exec count 4) -> Trigger Checkpoint 2
        # 6. Checkpoint 2
        # 7. Step 5 (exec count 5)
        # Total: 7 steps
        
        stored_steps = await store.get_steps(job_id)
        assert len(stored_steps) == 7, "Should have 5 original steps + 2 checkpoints"

        titles = [s["title"] for s in stored_steps]
        
        # Validate positions
        assert titles[0] == "Step 1"
        assert titles[1] == "Step 2"
        assert "Checkpoint 1" in titles[2]
        assert titles[3] == "Step 3"
        assert titles[4] == "Step 4"
        assert "Checkpoint 2" in titles[5]
        assert titles[6] == "Step 5"
        
        # Verify checkpoint content
        cp1 = stored_steps[2]
        assert cp1["instruction_prompt"].startswith("Run the full test suite")
        
        await store.close()

    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

@pytest.mark.asyncio
async def test_no_checkpoints_when_disabled():
    """Test that plan_propose_steps does NOT inject checkpoints if policy is 0 or missing."""
    from vibedev_mcp.store import VibeDevStore

    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "vibedev.sqlite3"))
        
        # Create job with policy 0 (disabled)
        job_id = await store.create_job(
            title="No Checkpoint Job",
            goal="Test no checkpoints",
            repo_root=None,
            policies={"checkpoint_interval_steps": 0},
        )

        steps = [{"title": f"Step {i+1}", "instruction_prompt": "x", "acceptance_criteria": [], "required_evidence": []} for i in range(5)]
        await store.plan_propose_steps(job_id, steps)

        stored_steps = await store.get_steps(job_id)
        assert len(stored_steps) == 5

        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
