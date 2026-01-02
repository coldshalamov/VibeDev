import asyncio
import json
import os
import shutil
import subprocess
import sys
import tempfile


def test_runner_cli_completes_single_step_job():
    """Integration: runner drives one step end-to-end and gates pass."""
    from vibedev_mcp.http_server import DEFAULT_POLICIES
    from vibedev_mcp.store import VibeDevStore

    tmp_dir = tempfile.mkdtemp()
    try:
        db_path = os.path.join(tmp_dir, "vibedev.sqlite3")

        async def _setup_job() -> str:
            store = await VibeDevStore.open(db_path)
            try:
                job_id = await store.create_job(
                    title="T",
                    goal="G",
                    repo_root=None,
                    policies=DEFAULT_POLICIES,
                )
                await store.plan_set_deliverables(job_id, ["D1"])
                await store.plan_set_invariants(job_id, [])
                await store.plan_set_definition_of_done(job_id, ["Done"])
                await store.plan_propose_steps(
                    job_id,
                    [{"title": "S", "instruction_prompt": "Do it"}],
                )
                ready = await store.job_set_ready(job_id)
                assert ready["ready"] is True
                await store.job_start(job_id)
                return job_id
            finally:
                await store.close()

        job_id = asyncio.run(_setup_job())

        evidence_path = os.path.join(tmp_dir, "evidence.json")
        with open(evidence_path, "w", encoding="utf-8") as f:
            f.write(
                json.dumps(
                    {
                        "diff_summary": "did thing",
                        "tests_run": ["python -m pytest -q"],
                        "tests_passed": True,
                        "devlog_line": "completed step",
                    }
                )
            )

        env = dict(os.environ)
        env["VIBEDEV_DB_PATH"] = str(db_path)

        proc = subprocess.run(
            [
                sys.executable,
                "-m",
                "vibedev_mcp.cli",
                "runner",
                "--job",
                job_id,
                "--evidence",
                str(evidence_path),
            ],
            env=env,
            text=True,
            capture_output=True,
        )
        assert proc.returncode == 0, proc.stderr

        async def _get_status() -> str:
            store = await VibeDevStore.open(db_path)
            try:
                job = await store.get_job(job_id)
                return str(job["status"])
            finally:
                await store.close()

        assert asyncio.run(_get_status()) == "COMPLETE"
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
