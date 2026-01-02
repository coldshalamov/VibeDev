from __future__ import annotations

import argparse
import asyncio
import json
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, AsyncIterator

from fastapi import Body, FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, ConfigDict, Field

from vibedev_mcp.conductor import compute_next_questions
from vibedev_mcp.models import ModelClaim
from vibedev_mcp.store import VibeDevStore
# from vibedev_mcp.templates import get_template, list_templates # Moved to store



def _default_db_path() -> Path:
    return Path.home() / ".vibedev" / "vibedev.sqlite3"


DEFAULT_POLICIES: dict[str, Any] = {
    "require_devlog_per_step": True,
    "require_commit_per_step": False,
    "allow_batch_commits": True,
    "require_tests_evidence": True,
    "require_diff_summary": True,
    "require_repo_snapshot_on_init": False,
    "inject_invariants_every_step": True,
    "inject_mistakes_every_step": True,
    "evidence_schema_mode": "loose",
    "max_retries_per_step": 2,
    "retry_exhausted_action": "PAUSE_FOR_HUMAN",
    # Safety: shell-executing gates are opt-in and allowlisted per job.
    "enable_shell_gates": False,
    "shell_gate_allowlist": [],
    "checkpoint_interval_steps": 5,
}


class CreateJobInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    title: str = Field(..., min_length=1)
    goal: str = Field(..., min_length=1)
    repo_root: str | None = Field(default=None)
    policies: dict[str, Any] | None = Field(default=None)


class AnswersInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    answers: dict[str, Any] = Field(default_factory=dict)


class DeliverablesInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    deliverables: list[str] = Field(default_factory=list)


class InvariantsInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    invariants: list[str] = Field(default_factory=list)


class DefinitionOfDoneInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    definition_of_done: list[str] = Field(default_factory=list)


class ProposeStepsInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    steps: list[dict[str, Any]] = Field(default_factory=list)


class RefineStepsInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    edits: list[dict[str, Any]] = Field(default_factory=list)


class FailJobInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reason: str = Field(..., min_length=1)


class SubmitStepInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    model_claim: ModelClaim = Field(...)
    summary: str = Field(..., min_length=1)
    evidence: dict[str, Any] = Field(default_factory=dict)
    devlog_line: str | None = None
    commit_hash: str | None = None


class AddContextBlockInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    block_type: str = Field(..., min_length=1)
    content: str = Field(..., min_length=1)
    tags: list[str] = Field(default_factory=list)


class RepoSnapshotInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    notes: str | None = None


class RepoMapUpdateInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    updates: dict[str, str] = Field(default_factory=dict)


class CreateTemplateInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    job_id: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1)
    description: str = Field(..., min_length=1)



class ApplyTemplateInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    overwrite_planning_artifacts: bool = False
    overwrite_steps: bool = True


def create_app(*, db_path: Path | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        effective_db = (
            Path(db_path)
            if db_path is not None
            else Path(os.environ.get("VIBEDEV_DB_PATH", str(_default_db_path())))
        )
        store = await VibeDevStore.open(effective_db)
        app.state.store = store
        try:
            yield
        finally:
            await store.close()

    app = FastAPI(title="VibeDev HTTP API", version="0.1.0", lifespan=lifespan)

    allow_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(KeyError)
    async def _handle_key_error(_: Request, exc: KeyError) -> Response:
        return JSONResponse(status_code=404, content={"error": "not_found", "detail": str(exc)})

    @app.exception_handler(ValueError)
    async def _handle_value_error(_: Request, exc: ValueError) -> Response:
        return JSONResponse(status_code=400, content={"error": "bad_request", "detail": str(exc)})

    def store_from(request: Request) -> VibeDevStore:
        return request.app.state.store

    # -------------------------------------------------------------------------
    # Jobs
    # -------------------------------------------------------------------------

    @app.get("/api/templates")
    async def templates(request: Request) -> dict[str, Any]:
        store = store_from(request)
        templates = await store.template_list()
        return {"count": len(templates), "templates": templates}

    @app.post("/api/templates")
    async def create_template(payload: CreateTemplateInput, request: Request) -> dict[str, Any]:
        store = store_from(request)
        template_id = await store.template_save_from_job(
            job_id=payload.job_id,
            title=payload.title,
            description=payload.description
        )
        return {"template_id": template_id}

    @app.delete("/api/templates/{template_id}")
    async def delete_template(template_id: str, request: Request) -> dict[str, Any]:
        store = store_from(request)
        deleted = await store.template_delete(template_id)
        if not deleted:
            # Maybe it's built-in or doesn't exist.
            # Check if it exists as built-in to give better error?
            # For now, just return 404 or false.
            raise HTTPException(status_code=404, detail="Template not found or cannot be deleted")
        return {"ok": True}

    @app.post("/api/jobs")
    async def create_job(payload: CreateJobInput, request: Request) -> dict[str, Any]:
        store = store_from(request)
        policies = dict(DEFAULT_POLICIES)
        if payload.policies:
            policies.update(payload.policies)
        job_id = await store.create_job(
            title=payload.title,
            goal=payload.goal,
            repo_root=payload.repo_root,
            policies=policies,
        )
        job = await store.get_job(job_id)
        questions = compute_next_questions(job)
        return {"job_id": job_id, "questions": questions}

    @app.get("/api/jobs")
    async def list_jobs(
        request: Request,
        status: str | None = Query(default=None),
        limit: int = Query(default=50, ge=1, le=200),
        offset: int = Query(default=0, ge=0),
    ) -> dict[str, Any]:
        store = store_from(request)
        result = await store.job_list(status=status, limit=limit, offset=offset)
        return {"count": result["count"], "jobs": result["items"]}

    @app.get("/api/jobs/{job_id}")
    async def get_job(job_id: str, request: Request) -> dict[str, Any]:
        store = store_from(request)
        return await store.get_job(job_id)

    @app.get("/api/jobs/{job_id}/ui-state")
    async def get_ui_state(job_id: str, request: Request) -> dict[str, Any]:
        store = store_from(request)
        return await store.get_ui_state(job_id)

    # -------------------------------------------------------------------------
    # Planning questions
    # -------------------------------------------------------------------------

    @app.get("/api/jobs/{job_id}/questions")
    async def get_questions(job_id: str, request: Request) -> dict[str, Any]:
        store = store_from(request)
        job = await store.get_job(job_id)
        return {"questions": compute_next_questions(job)}

    @app.post("/api/jobs/{job_id}/questions")
    async def answer_questions(job_id: str, payload: AnswersInput, request: Request) -> dict[str, Any]:
        store = store_from(request)
        await store.conductor_merge_answers(job_id, payload.answers)
        job = await store.get_job(job_id)
        return {"ok": True, "questions": compute_next_questions(job)}

    # -------------------------------------------------------------------------
    # Plan compilation
    # -------------------------------------------------------------------------

    @app.post("/api/jobs/{job_id}/deliverables")
    async def set_deliverables(job_id: str, payload: DeliverablesInput, request: Request) -> dict[str, Any]:
        store = store_from(request)
        await store.plan_set_deliverables(job_id, payload.deliverables)
        return {"ok": True}

    @app.post("/api/jobs/{job_id}/invariants")
    async def set_invariants(job_id: str, payload: InvariantsInput, request: Request) -> dict[str, Any]:
        store = store_from(request)
        await store.plan_set_invariants(job_id, payload.invariants)
        return {"ok": True}

    @app.post("/api/jobs/{job_id}/definition-of-done")
    async def set_definition_of_done(
        job_id: str, payload: DefinitionOfDoneInput, request: Request
    ) -> dict[str, Any]:
        store = store_from(request)
        await store.plan_set_definition_of_done(job_id, payload.definition_of_done)
        return {"ok": True}

    @app.post("/api/jobs/{job_id}/steps")
    async def propose_steps(job_id: str, payload: ProposeStepsInput, request: Request) -> dict[str, Any]:
        store = store_from(request)
        normalized = await store.plan_propose_steps(job_id, payload.steps)
        return {"steps": normalized}

    @app.patch("/api/jobs/{job_id}/steps")
    async def refine_steps(job_id: str, payload: RefineStepsInput, request: Request) -> dict[str, Any]:
        store = store_from(request)
        normalized = await store.plan_refine_steps(job_id, payload.edits)
        return {"ok": True, "steps": normalized}

    @app.post("/api/jobs/{job_id}/templates/{template_id}/apply")
    async def apply_template(
        job_id: str,
        template_id: str,
        payload: ApplyTemplateInput,
        request: Request,
    ) -> dict[str, Any]:
        store = store_from(request)
        template = await store.template_get(template_id)

        # Policies: always merge in the template's recommended policies.
        await store.job_update_policies(
            job_id=job_id,
            update=template.get("recommended_policies") or {},
            merge=True,
        )

        job = await store.get_job(job_id)

        # Planning artifacts: optionally overwrite, otherwise fill only if empty.
        if payload.overwrite_planning_artifacts or not job.get("deliverables"):
            await store.plan_set_deliverables(job_id, template.get("deliverables") or [])
        if payload.overwrite_planning_artifacts or job.get("invariants") is None:
            await store.plan_set_invariants(job_id, template.get("invariants") or [])
        if payload.overwrite_planning_artifacts or not job.get("definition_of_done"):
            await store.plan_set_definition_of_done(
                job_id, template.get("definition_of_done") or []
            )

        steps_out: list[dict[str, Any]] = []
        if payload.overwrite_steps:
            await store.plan_propose_steps(job_id, template.get("steps") or [])
            steps_out = await store.get_steps(job_id)

        job = await store.get_job(job_id)
        return {"ok": True, "job": job, "steps": steps_out}

    @app.post("/api/jobs/{job_id}/ready")
    async def set_ready(job_id: str, request: Request) -> dict[str, Any]:       
        store = store_from(request)
        return await store.job_set_ready(job_id)

    # -------------------------------------------------------------------------
    # Execution lifecycle
    # -------------------------------------------------------------------------

    @app.post("/api/jobs/{job_id}/start")
    async def start(job_id: str, request: Request) -> dict[str, Any]:
        store = store_from(request)
        return await store.job_start(job_id)

    @app.post("/api/jobs/{job_id}/pause")
    async def pause(job_id: str, request: Request) -> dict[str, Any]:
        store = store_from(request)
        return await store.job_pause(job_id)

    @app.post("/api/jobs/{job_id}/resume")
    async def resume(job_id: str, request: Request) -> dict[str, Any]:
        store = store_from(request)
        return await store.job_resume(job_id)

    @app.post("/api/jobs/{job_id}/fail")
    async def fail(job_id: str, payload: FailJobInput, request: Request) -> dict[str, Any]:
        store = store_from(request)
        return await store.job_fail(job_id, payload.reason)

    @app.post("/api/jobs/{job_id}/archive")
    async def archive(job_id: str, request: Request) -> dict[str, Any]:
        store = store_from(request)
        await store.job_archive(job_id=job_id)
        return {"ok": True}

    @app.get("/api/jobs/{job_id}/step-prompt")
    async def step_prompt(job_id: str, request: Request) -> dict[str, Any]:
        store = store_from(request)
        return await store.job_next_step_prompt(job_id)

    @app.post("/api/jobs/{job_id}/steps/{step_id}/submit")
    async def submit_step(
        job_id: str, step_id: str, payload: SubmitStepInput, request: Request
    ) -> dict[str, Any]:
        store = store_from(request)
        return await store.job_submit_step_result(
            job_id=job_id,
            step_id=step_id,
            model_claim=payload.model_claim,
            summary=payload.summary,
            evidence=payload.evidence,
            devlog_line=payload.devlog_line,
            commit_hash=payload.commit_hash,
        )

    @app.post("/api/jobs/{job_id}/steps/{step_id}/approve")
    async def approve_step(job_id: str, step_id: str, request: Request) -> dict[str, Any]:
        """Grant human approval for a step (for human_approval gates)."""
        store = store_from(request)
        return await store.approve_step(job_id=job_id, step_id=step_id)

    @app.delete("/api/jobs/{job_id}/steps/{step_id}/approve")
    async def revoke_step_approval(job_id: str, step_id: str, request: Request) -> dict[str, Any]:
        """Revoke human approval for a step."""
        store = store_from(request)
        return await store.revoke_step_approval(job_id=job_id, step_id=step_id)

    # -------------------------------------------------------------------------
    # Context
    # -------------------------------------------------------------------------

    @app.post("/api/jobs/{job_id}/context")
    async def add_context(job_id: str, payload: AddContextBlockInput, request: Request) -> dict[str, Any]:
        store = store_from(request)
        context_id = await store.context_add_block(
            job_id=job_id,
            block_type=payload.block_type,
            content=payload.content,
            tags=payload.tags,
        )
        return {"context_id": context_id}

    @app.get("/api/jobs/{job_id}/context/{context_id}")
    async def get_context(job_id: str, context_id: str, request: Request) -> dict[str, Any]:
        store = store_from(request)
        return await store.context_get_block(job_id=job_id, context_id=context_id)

    @app.get("/api/jobs/{job_id}/context/search")
    async def search_context(
        job_id: str,
        request: Request,
        q: str = Query(default=""),
        limit: int = Query(default=20, ge=1, le=200),
    ) -> dict[str, Any]:
        store = store_from(request)
        results = await store.context_search(job_id=job_id, query=q, limit=limit)
        return {"results": results}

    # -------------------------------------------------------------------------
    # Devlog + mistakes
    # -------------------------------------------------------------------------

    @app.post("/api/jobs/{job_id}/devlog")
    async def append_devlog(
        job_id: str,
        request: Request,
        content: str = Body(..., embed=True),
        step_id: str | None = Body(default=None, embed=True),
    ) -> dict[str, Any]:
        store = store_from(request)
        log_id = await store.devlog_append(job_id=job_id, content=content, step_id=step_id)
        return {"log_id": log_id}

    @app.get("/api/jobs/{job_id}/devlog")
    async def list_devlog(
        job_id: str,
        request: Request,
        log_type: str | None = Query(default=None),
        limit: int = Query(default=100, ge=1, le=1000),
    ) -> dict[str, Any]:
        store = store_from(request)
        entries = await store.devlog_list(job_id=job_id, log_type=log_type, limit=limit)
        return {"count": len(entries), "entries": entries}

    @app.get("/api/jobs/{job_id}/devlog/export")
    async def export_devlog(
        job_id: str,
        request: Request,
        format: str = Query(default="md"),
    ) -> dict[str, Any]:
        store = store_from(request)
        return await store.devlog_export(job_id=job_id, format=format)

    @app.post("/api/jobs/{job_id}/mistakes")
    async def record_mistake(
        job_id: str,
        request: Request,
        title: str = Body(..., embed=True),
        what_happened: str = Body(..., embed=True),
        why: str = Body(..., embed=True),
        lesson: str = Body(..., embed=True),
        avoid_next_time: str = Body(..., embed=True),
        tags: list[str] = Body(default_factory=list, embed=True),
        related_step_id: str | None = Body(default=None, embed=True),
    ) -> dict[str, Any]:
        store = store_from(request)
        mistake_id = await store.mistake_record(
            job_id=job_id,
            title=title,
            what_happened=what_happened,
            why=why,
            lesson=lesson,
            avoid_next_time=avoid_next_time,
            tags=tags,
            related_step_id=related_step_id,
        )
        return {"mistake_id": mistake_id}

    @app.get("/api/jobs/{job_id}/mistakes")
    async def list_mistakes(
        job_id: str,
        request: Request,
        limit: int = Query(default=50, ge=1, le=200),
    ) -> dict[str, Any]:
        store = store_from(request)
        entries = await store.mistake_list(job_id=job_id, limit=limit)
        return {"count": len(entries), "entries": entries}

    # -------------------------------------------------------------------------
    # Git + repo helpers
    # -------------------------------------------------------------------------

    @app.get("/api/jobs/{job_id}/git/status")
    async def git_status(job_id: str, request: Request) -> dict[str, Any]:
        store = store_from(request)
        return await store.git_status(job_id=job_id)

    @app.get("/api/jobs/{job_id}/git/diff")
    async def git_diff(job_id: str, request: Request, staged: bool = Query(default=False)) -> dict[str, Any]:
        store = store_from(request)
        return await store.git_diff_summary(job_id=job_id, staged=staged)

    @app.get("/api/jobs/{job_id}/git/log")
    async def git_log(job_id: str, request: Request, n: int = Query(default=10, ge=1, le=100)) -> dict[str, Any]:
        store = store_from(request)
        return await store.git_log(job_id=job_id, n=n)

    @app.post("/api/jobs/{job_id}/repo/snapshot")
    async def repo_snapshot(job_id: str, payload: RepoSnapshotInput, request: Request) -> dict[str, Any]:
        store = store_from(request)
        job = await store.get_job(job_id)
        repo_root = job.get("repo_root")
        if not repo_root:
            raise HTTPException(status_code=400, detail="repo_root is not set for this job")
        return await store.repo_snapshot(job_id=job_id, repo_root=repo_root, notes=payload.notes)

    @app.get("/api/jobs/{job_id}/repo/map")
    async def repo_map(job_id: str, request: Request, format: str = Query(default="json")) -> dict[str, Any]:
        store = store_from(request)
        return await store.repo_map_export(job_id=job_id, format=format)

    @app.patch("/api/jobs/{job_id}/repo/map")
    async def repo_map_update(job_id: str, payload: RepoMapUpdateInput, request: Request) -> dict[str, Any]:
        store = store_from(request)
        return await store.repo_file_descriptions_update(job_id=job_id, updates=payload.updates)

    @app.get("/api/jobs/{job_id}/repo/hygiene")
    async def repo_hygiene(job_id: str, request: Request, max_suggestions: int = Query(default=20, ge=1, le=100)) -> dict[str, Any]:
        store = store_from(request)
        return await store.repo_hygiene_suggest(job_id=job_id, max_suggestions=max_suggestions)

    # -------------------------------------------------------------------------
    # Export
    # -------------------------------------------------------------------------

    @app.get("/api/jobs/{job_id}/export")
    async def export(job_id: str, request: Request, format: str = Query(default="json")) -> dict[str, Any]:
        store = store_from(request)
        return await store.job_export_bundle(job_id=job_id, format=format)

    # -------------------------------------------------------------------------
    # SSE
    # -------------------------------------------------------------------------

    @app.get("/api/jobs/{job_id}/events")
    async def events(job_id: str, request: Request) -> StreamingResponse:
        store = store_from(request)

        async def gen() -> AsyncIterator[bytes]:
            last_job_updated_at: str | None = None
            last_phase: int | None = None
            last_current_step_id: str | None = None
            last_attempt_id: str | None = None
            last_mistake_id: str | None = None
            last_log_id: str | None = None

            async def emit(evt_type: str, data: Any) -> bytes:
                payload = json.dumps({"type": evt_type, "data": data}, default=str)
                return f"data: {payload}\n\n".encode("utf-8")

            # Prime state
            job = await store.get_job(job_id)
            last_job_updated_at = job.get("updated_at")
            ui = await store.get_ui_state(job_id)
            last_phase = ui.get("phase", {}).get("current_phase")
            if ui.get("current_step"):
                last_current_step_id = ui["current_step"]["step_id"]

            yield await emit("job_updated", ui.get("job"))

            while True:
                if await request.is_disconnected():
                    return

                await asyncio.sleep(1.0)

                job = await store.get_job(job_id)
                if job.get("updated_at") != last_job_updated_at:
                    last_job_updated_at = job.get("updated_at")
                    yield await emit("job_updated", job)

                ui = await store.get_ui_state(job_id)
                phase_now = ui.get("phase", {}).get("current_phase")
                if phase_now is not None and phase_now != last_phase:
                    last_phase = phase_now
                    yield await emit("phase_changed", ui.get("phase"))

                current_step = ui.get("current_step")
                current_step_id = current_step.get("step_id") if current_step else None
                if current_step_id and current_step_id != last_current_step_id:
                    last_current_step_id = current_step_id
                    yield await emit("step_started", {"step_id": current_step_id})

                attempts = await store.get_attempts(job_id, step_id=None, limit=1)
                if attempts:
                    if attempts[0]["attempt_id"] != last_attempt_id:
                        last_attempt_id = attempts[0]["attempt_id"]
                        yield await emit("attempt_submitted", attempts[0])

                mistakes = await store.mistake_list(job_id=job_id, limit=1)
                if mistakes:
                    if mistakes[0]["mistake_id"] != last_mistake_id:
                        last_mistake_id = mistakes[0]["mistake_id"]
                        yield await emit("mistake_recorded", mistakes[0])

                logs = await store.devlog_list(job_id=job_id, limit=1)
                if logs:
                    if logs[0]["log_id"] != last_log_id:
                        last_log_id = logs[0]["log_id"]
                        yield await emit("devlog_appended", logs[0])

        return StreamingResponse(gen(), media_type="text/event-stream")

    return app


app = create_app()


def serve_main(argv: list[str] | None = None) -> None:
    import uvicorn

    parser = argparse.ArgumentParser(prog="vibedev-mcp serve")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=int(os.environ.get("VIBEDEV_HTTP_PORT", "8765")))
    args = parser.parse_args(argv)

    uvicorn.run("vibedev_mcp.http_server:app", host=args.host, port=args.port, reload=False)
