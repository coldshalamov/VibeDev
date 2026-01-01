"""Tests for custom process templates."""

import os
import shutil
import tempfile
import pytest
from vibedev_mcp.store import VibeDevStore

@pytest.mark.asyncio
async def test_custom_template_lifecycle():
    """Test saving a job as a template and applying it to a new job."""
    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "vibedev.sqlite3"))
        
        # 1. Create a source job
        source_job_id = await store.create_job(
            title="Source Job",
            goal="Create template",
            repo_root=None,
            policies={"enable_shell_gates": True},
        )
        
        # Add a step to source job
        steps = [{
            "title": "Unique Source Step",
            "instruction_prompt": "Do something unique.",
            "acceptance_criteria": ["Criteria 1"],
            "required_evidence": ["evidence1"],
        }]
        await store.plan_propose_steps(source_job_id, steps)
        
        # 2. Save as template
        template_id = await store.template_save_from_job(
            job_id=source_job_id,
            title="My Custom Template",
            description="A test template",
        )
        
        # 3. List templates and verify
        templates = await store.template_list()
        custom_tpl = next((t for t in templates if t["template_id"] == template_id), None)
        assert custom_tpl is not None
        assert custom_tpl["title"] == "My Custom Template"
        
        # 4. Get template detail
        tpl_detail = await store.template_get(template_id)
        assert tpl_detail["steps"][0]["title"] == "Unique Source Step"
        assert tpl_detail["recommended_policies"]["enable_shell_gates"] is True
        
        # 5. Apply template to a new job
        dest_job_id = await store.create_job(
            title="Dest Job",
            goal="Reuse template",
            repo_root=None,
            policies={},
        )
        
        # verify initial state (0 steps or empty)
        s0 = await store.get_steps(dest_job_id)
        assert len(s0) == 0
        
        # Apply Logic (mimic http_server apply_template logic)
        # We can call the store/http helper logic. 
        # Since we are testing store + logic, let's just do what the endpoint does manually
        # to verify the store methods support it.
        
        # Policies
        await store.job_update_policies(
            job_id=dest_job_id,
            update=tpl_detail.get("recommended_policies") or {},
            merge=True,
        )
        
        # Steps
        await store.plan_propose_steps(dest_job_id, tpl_detail.get("steps") or [])
        
        # Verify destination job
        s_final = await store.get_steps(dest_job_id)
        assert len(s_final) == 1
        assert s_final[0]["title"] == "Unique Source Step"
        
        job_final = await store.get_job(dest_job_id)
        assert job_final["policies"].get("enable_shell_gates") is True
        
        # 6. Delete template
        assert await store.template_delete(template_id) is True
        
        # Verify gone
        templates_after = await store.template_list()
        assert not any(t["template_id"] == template_id for t in templates_after)
        
        await store.close()

    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
