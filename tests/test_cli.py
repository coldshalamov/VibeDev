"""Tests for the CLI module."""

import pytest
import sys
import asyncio
import tempfile
from pathlib import Path
from unittest.mock import patch, AsyncMock, MagicMock

from vibedev_mcp.cli import main, _status_job, _list_jobs


class TestCLIHelp:
    def test_help_flag(self):
        with pytest.raises(SystemExit) as exc_info:
            main(["--help"])
        assert exc_info.value.code == 0

    def test_runner_help(self):
        with pytest.raises(SystemExit) as exc_info:
            main(["runner", "--help"])
        assert exc_info.value.code == 0

    def test_status_help(self):
        with pytest.raises(SystemExit) as exc_info:
            main(["status", "--help"])
        assert exc_info.value.code == 0

    def test_list_help(self):
        with pytest.raises(SystemExit) as exc_info:
            main(["list", "--help"])
        assert exc_info.value.code == 0


class TestStatusJob:
    @pytest.mark.asyncio
    async def test_status_job_not_found(self):
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = f.name
        
        with patch.dict('os.environ', {'VIBEDEV_DB_PATH': db_path}):
            with patch('vibedev_mcp.cli._default_db_path', return_value=Path(db_path)):
                result = await _status_job(job_id="JOB-NOTFOUND")
                # Should return error code
                assert result == 1

    @pytest.mark.asyncio
    async def test_status_job_found(self):
        from vibedev_mcp.store import VibeDevStore
        
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = Path(f.name)

        store = await VibeDevStore.open(db_path)
        try:
            job_id = await store.create_job(
                title="Test Job",
                goal="Test goal",
                repo_root=None,
                policies={},
            )
        finally:
            await store.close()
        
        with patch.dict('os.environ', {'VIBEDEV_DB_PATH': str(db_path)}):
            with patch('vibedev_mcp.cli._default_db_path', return_value=db_path):
                result = await _status_job(job_id=job_id)
                # Should return success
                assert result == 0


class TestListJobs:
    @pytest.mark.asyncio
    async def test_list_jobs_empty(self):
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = Path(f.name)

        with patch.dict('os.environ', {'VIBEDEV_DB_PATH': str(db_path)}):
            with patch('vibedev_mcp.cli._default_db_path', return_value=db_path):
                result = await _list_jobs(status_filter=None, limit=50)
                assert result == 0

    @pytest.mark.asyncio
    async def test_list_jobs_with_jobs(self):
        from vibedev_mcp.store import VibeDevStore
        
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = Path(f.name)

        store = await VibeDevStore.open(db_path)
        try:
            await store.create_job(
                title="Job 1",
                goal="Goal 1",
                repo_root=None,
                policies={},
            )
            await store.create_job(
                title="Job 2",
                goal="Goal 2",
                repo_root=None,
                policies={},
            )
        finally:
            await store.close()

        with patch.dict('os.environ', {'VIBEDEV_DB_PATH': str(db_path)}):
            with patch('vibedev_mcp.cli._default_db_path', return_value=db_path):
                result = await _list_jobs(status_filter=None, limit=50)
                assert result == 0

    @pytest.mark.asyncio
    async def test_list_jobs_with_status_filter(self):
        from vibedev_mcp.store import VibeDevStore
        
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = Path(f.name)

        store = await VibeDevStore.open(db_path)
        try:
            await store.create_job(
                title="Job 1",
                goal="Goal 1",
                repo_root=None,
                policies={},
            )
        finally:
            await store.close()

        with patch.dict('os.environ', {'VIBEDEV_DB_PATH': str(db_path)}):
            with patch('vibedev_mcp.cli._default_db_path', return_value=db_path):
                # Filter for READY jobs (none should exist)
                result = await _list_jobs(status_filter="READY", limit=50)
                assert result == 0
                
                # Filter for PLANNING jobs (should find one)
                result = await _list_jobs(status_filter="PLANNING", limit=50)
                assert result == 0
