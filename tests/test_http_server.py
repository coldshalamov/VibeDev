import os
import shutil
import tempfile

from fastapi.testclient import TestClient


def test_http_full_workflow_smoke():
    from vibedev_mcp.http_server import create_app

    tmp_dir = tempfile.mkdtemp()
    try:
        db_path = os.path.join(tmp_dir, "vibedev.sqlite3")
        app = create_app(db_path=db_path)

        with TestClient(app) as client:
            # Create job
            resp = client.post("/api/jobs", json={"title": "T", "goal": "G"})
            assert resp.status_code == 200
            job_id = resp.json()["job_id"]

            # Answer phase 1 questions (minimal)
            resp = client.post(
                f"/api/jobs/{job_id}/questions",
                json={
                    "answers": {
                        "repo_exists": False,
                        "out_of_scope": "",
                        "target_environment": "Windows",
                        "timeline_priority": "MVP",
                    }
                },
            )
            assert resp.status_code == 200

            # Compile plan artifacts
            assert client.post(
                f"/api/jobs/{job_id}/deliverables", json={"deliverables": ["D1"]}
            ).status_code == 200
            assert client.post(
                f"/api/jobs/{job_id}/invariants", json={"invariants": []}
            ).status_code == 200
            assert client.post(
                f"/api/jobs/{job_id}/definition-of-done",
                json={"definition_of_done": ["Done"]},
            ).status_code == 200
            resp = client.post(
                f"/api/jobs/{job_id}/steps",
                json={"steps": [{"title": "S", "instruction_prompt": "Do it"}]},
            )
            assert resp.status_code == 200

            # Ready -> start
            resp = client.post(f"/api/jobs/{job_id}/ready")
            assert resp.status_code == 200
            assert resp.json()["ready"] is True
            assert client.post(f"/api/jobs/{job_id}/start").status_code == 200

            # Get step prompt
            resp = client.get(f"/api/jobs/{job_id}/step-prompt")
            assert resp.status_code == 200
            step_id = resp.json()["step_id"]

            # Submit step result with required evidence
            resp = client.post(
                f"/api/jobs/{job_id}/steps/{step_id}/submit",
                json={
                    "model_claim": "MET",
                    "summary": "done",
                    "evidence": {
                        "diff_summary": "did thing",
                        "tests_run": ["pytest -q"],
                        "tests_passed": True,
                    },
                    "devlog_line": "completed step",
                },
            )
            assert resp.status_code == 200
            assert resp.json()["accepted"] is True

            # UI state reflects completion
            ui = client.get(f"/api/jobs/{job_id}/ui-state").json()
            assert ui["job"]["status"] == "COMPLETE"
            assert ui["steps"][0]["status"] == "DONE"
            assert ui["steps"][0]["attempt_count"] >= 1
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def test_http_job_list():
    from vibedev_mcp.http_server import create_app

    tmp_dir = tempfile.mkdtemp()
    try:
        db_path = os.path.join(tmp_dir, "vibedev.sqlite3")
        app = create_app(db_path=db_path)
        with TestClient(app) as client:
            client.post("/api/jobs", json={"title": "J1", "goal": "G1"})
            client.post("/api/jobs", json={"title": "J2", "goal": "G2"})
            resp = client.get("/api/jobs")
            assert resp.status_code == 200
            payload = resp.json()
            assert payload["count"] == 2
            assert len(payload["jobs"]) == 2
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
