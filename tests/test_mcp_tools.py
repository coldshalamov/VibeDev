import pytest


@pytest.mark.asyncio
async def test_mcp_server_registers_core_tools():
    from vibedev_mcp.server import mcp

    tools = await mcp.list_tools()
    names = {t.name for t in tools}
    assert "conductor_init" in names
    assert "conductor_next_questions" in names
    assert "conductor_answer" in names
    assert "context_add_block" in names
    assert "context_get_block" in names
    assert "context_search" in names
    assert "plan_set_deliverables" in names
    assert "plan_set_invariants" in names
    assert "plan_set_definition_of_done" in names
    assert "plan_propose_steps" in names
    assert "job_set_ready" in names
    assert "job_start" in names
    assert "job_next_step_prompt" in names
    assert "job_submit_step_result" in names
    assert "devlog_append" in names
    assert "mistake_record" in names
    assert "mistake_list" in names
    assert "repo_snapshot" in names
    assert "repo_file_descriptions_update" in names
    assert "repo_map_export" in names
    assert "repo_find_stale_candidates" in names
    assert "job_export_bundle" in names
    assert "job_archive" in names
    assert "template_list" in names
    assert "template_apply" in names
