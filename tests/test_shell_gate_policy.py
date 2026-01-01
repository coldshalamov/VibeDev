import os
import shutil
import sys
import tempfile

from fastapi.testclient import TestClient


def _python_exit_0_command() -> str:
    exe = sys.executable
    # Quote the executable path to handle spaces (Windows).
    return f"\"{exe}\" -c \"import sys; print('ok'); sys.exit(0)\""


def _create_job_with_step(*, client: TestClient, policies: dict | None) -> tuple[str, str]:
    resp = client.post(
        "/api/jobs",
        json={"title": "T", "goal": "G", "repo_root": os.getcwd(), "policies": policies or {}},
    )
    assert resp.status_code == 200
    job_id = resp.json()["job_id"]

    assert (
        client.post(f"/api/jobs/{job_id}/deliverables", json={"deliverables": ["D1"]}).status_code
        == 200
    )
    assert client.post(f"/api/jobs/{job_id}/invariants", json={"invariants": []}).status_code == 200
    assert (
        client.post(
            f"/api/jobs/{job_id}/definition-of-done",
            json={"definition_of_done": ["Done"]},
        ).status_code
        == 200
    )

    resp = client.post(
        f"/api/jobs/{job_id}/steps",
        json={
            "steps": [
                {
                    "title": "S1",
                    "instruction_prompt": "Do it",
                    "gates": [
                        {
                            "type": "command_exit_0",
                            "parameters": {"command": _python_exit_0_command(), "timeout": 10},
                            "description": "Command should exit 0",
                        }
                    ],
                }
            ]
        },
    )
    assert resp.status_code == 200

    resp = client.post(f"/api/jobs/{job_id}/ready")
    assert resp.status_code == 200
    assert resp.json()["ready"] is True
    assert client.post(f"/api/jobs/{job_id}/start").status_code == 200

    resp = client.get(f"/api/jobs/{job_id}/step-prompt")
    assert resp.status_code == 200
    return job_id, resp.json()["step_id"]


def test_shell_gates_blocked_by_default_policy():
    from vibedev_mcp.http_server import create_app

    tmp_dir = tempfile.mkdtemp()
    try:
        db_path = os.path.join(tmp_dir, "vibedev.sqlite3")
        app = create_app(db_path=db_path)

        with TestClient(app) as client:
            job_id, step_id = _create_job_with_step(client=client, policies=None)

            resp = client.post(
                f"/api/jobs/{job_id}/steps/{step_id}/submit",
                json={
                    "model_claim": "MET",
                    "summary": "done",
                    "evidence": {
                        "diff_summary": "did thing",
                        "tests_run": ["python -m pytest -q"],
                        "tests_passed": True,
                    },
                    "devlog_line": "attempt 1",
                },
            )
            assert resp.status_code == 200
            payload = resp.json()
            assert payload["accepted"] is False
            assert any("command_exit_0" in r for r in payload.get("rejection_reasons", []))
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def test_shell_gates_allowlisted_command_runs_when_enabled():
    from vibedev_mcp.http_server import create_app

    tmp_dir = tempfile.mkdtemp()
    try:
        db_path = os.path.join(tmp_dir, "vibedev.sqlite3")
        app = create_app(db_path=db_path)

        with TestClient(app) as client:
            job_id, step_id = _create_job_with_step(
                client=client,
                policies={
                    "enable_shell_gates": True,
                    "shell_gate_allowlist": ["*python* -c*"],
                },
            )

            resp = client.post(
                f"/api/jobs/{job_id}/steps/{step_id}/submit",
                json={
                    "model_claim": "MET",
                    "summary": "done",
                    "evidence": {
                        "diff_summary": "did thing",
                        "tests_run": ["python -m pytest -q"],
                        "tests_passed": True,
                    },
                    "devlog_line": "attempt 1",
                },
            )
            assert resp.status_code == 200
            payload = resp.json()
            assert payload["accepted"] is True
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def test_shell_gates_reject_command_not_in_allowlist():
    from vibedev_mcp.http_server import create_app

    tmp_dir = tempfile.mkdtemp()
    try:
        db_path = os.path.join(tmp_dir, "vibedev.sqlite3")
        app = create_app(db_path=db_path)

        with TestClient(app) as client:
            job_id, step_id = _create_job_with_step(
                client=client,
                policies={
                    "enable_shell_gates": True,
                    "shell_gate_allowlist": ["echo*"],
                },
            )

            resp = client.post(
                f"/api/jobs/{job_id}/steps/{step_id}/submit",
                json={
                    "model_claim": "MET",
                    "summary": "done",
                    "evidence": {
                        "diff_summary": "did thing",
                        "tests_run": ["python -m pytest -q"],
                        "tests_passed": True,
                    },
                    "devlog_line": "attempt 1",
                },
            )
            assert resp.status_code == 200
            payload = resp.json()
            assert payload["accepted"] is False
            assert any("allowlist" in r.lower() for r in payload.get("rejection_reasons", []))
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

