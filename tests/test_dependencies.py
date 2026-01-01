"""Tests for dependency analysis and storage."""

import os
import shutil
import tempfile
import json
import pytest
from pathlib import Path
from vibedev_mcp.repo import analyze_dependencies
from vibedev_mcp.store import VibeDevStore

def test_analyze_dependencies_heuristics():
    """Test regex-based dependency analysis."""
    tmp_dir = tempfile.mkdtemp()
    try:
        root = Path(tmp_dir)
        
        # Python files
        (root / "main.py").write_text("import utils\nfrom lib import helper", encoding="utf-8")
        (root / "utils.py").write_text("import os", encoding="utf-8")
        (root / "lib").mkdir()
        (root / "lib/helper.py").write_text("", encoding="utf-8")
        
        # JS files
        (root / "app.js").write_text("const lib = require('./lib');\nimport { foo } from 'bar';", encoding="utf-8")
        
        deps = analyze_dependencies(root)
        
        assert "main.py" in deps
        assert "utils" in deps["main.py"]
        assert "lib" in deps["main.py"]
        
        assert "utils.py" in deps
        assert "os" in deps["utils.py"]
        
        assert "app.js" in deps
        assert "./lib" in deps["app.js"]
        assert "bar" in deps["app.js"]
        
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

@pytest.mark.asyncio
async def test_repo_snapshot_stores_dependencies():
    """Test that repo_snapshot captures dependencies."""
    tmp_dir = tempfile.mkdtemp()
    try:
        # Create dummy repo in tmp_dir/repo
        repo_dir = os.path.join(tmp_dir, "repo")
        os.makedirs(repo_dir)
        Path(os.path.join(repo_dir, "test.py")).write_text("import math", encoding="utf-8")
        
        # Init DB
        store = await VibeDevStore.open(os.path.join(tmp_dir, "vibedev.sqlite3"))
        job_id = await store.create_job(
            title="Dep Test",
            goal="Test deps",
            repo_root=repo_dir,
            policies={},
        )
        
        # Take snapshot
        snap = await store.repo_snapshot(job_id=job_id, repo_root=repo_dir)
        
        # Verify return value
        assert "dependencies" in snap
        assert "test.py" in snap["dependencies"]
        assert "math" in snap["dependencies"]["test.py"]
        
        # Verify DB storage
        async with store._conn.execute("SELECT dependencies_json FROM repo_snapshots WHERE snapshot_id = ?", (snap["snapshot_id"],)) as cursor:
            row = await cursor.fetchone()
            assert row is not None
            d_json = row[0]
            d = json.loads(d_json)
            assert d["test.py"] == ["math"]
            
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
