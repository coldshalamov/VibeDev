import os
import shutil
import tempfile

import pytest


@pytest.mark.asyncio
async def test_repo_map_update_and_export():
    from vibedev_mcp.store import VibeDevStore

    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "vibedev.sqlite3"))
        job_id = await store.create_job(title="T", goal="G", repo_root=None, policies={})

        await store.repo_file_descriptions_update(
            job_id=job_id,
            updates={"a.py": "entry", "b/c.py": "helper"},
        )
        exported = await store.repo_map_export(job_id=job_id, format="json")
        assert exported["format"] == "json"
        paths = {e["path"] for e in exported["entries"]}
        assert "a.py" in paths
        assert "b/c.py" in paths
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
