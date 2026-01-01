import os
import shutil
import tempfile

from fastapi.testclient import TestClient


def test_templates_list_and_apply():
    from vibedev_mcp.http_server import create_app

    tmp_dir = tempfile.mkdtemp()
    try:
        db_path = os.path.join(tmp_dir, "vibedev.sqlite3")
        app = create_app(db_path=db_path)

        with TestClient(app) as client:
            resp = client.get("/api/templates")
            assert resp.status_code == 200
            payload = resp.json()
            assert isinstance(payload.get("templates"), list)
            assert payload.get("count") == len(payload["templates"])
            assert any(t.get("template_id") == "strict_feature" for t in payload["templates"])

            # Create a blank job and apply a template.
            resp = client.post("/api/jobs", json={"title": "T", "goal": "G", "repo_root": os.getcwd()})
            assert resp.status_code == 200
            job_id = resp.json()["job_id"]

            resp = client.post(f"/api/jobs/{job_id}/templates/strict_feature/apply", json={})
            assert resp.status_code == 200
            applied = resp.json()
            assert applied["ok"] is True
            assert applied["job"]["job_id"] == job_id
            assert applied["job"]["policies"]["enable_shell_gates"] is True
            assert isinstance(applied["steps"], list)
            assert len(applied["steps"]) >= 2
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

