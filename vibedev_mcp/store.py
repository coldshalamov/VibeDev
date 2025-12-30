import json
import secrets
import string
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import aiosqlite

from vibedev_mcp.repo import find_stale_candidates, snapshot_file_tree


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id(prefix: str, length: int = 4) -> str:
    alphabet = string.ascii_uppercase + string.digits
    suffix = "".join(secrets.choice(alphabet) for _ in range(length))
    return f"{prefix}-{suffix}"


class VibeDevStore:
    def __init__(self, db_path: Path, conn: aiosqlite.Connection) -> None:
        self._db_path = db_path
        self._conn = conn

    @classmethod
    async def open(cls, db_path: Path) -> "VibeDevStore":
        db_path = Path(db_path)
        db_path.parent.mkdir(parents=True, exist_ok=True)

        conn = await aiosqlite.connect(db_path)
        conn.row_factory = aiosqlite.Row
        await conn.execute("PRAGMA foreign_keys = ON;")

        store = cls(db_path=db_path, conn=conn)
        await store._init_schema()
        return store

    async def close(self) -> None:
        await self._conn.close()

    async def _init_schema(self) -> None:
        await self._conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS jobs (
              job_id TEXT PRIMARY KEY,
              title TEXT NOT NULL,
              goal TEXT NOT NULL,
              status TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              repo_root TEXT,
              policies_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS steps (
              job_id TEXT NOT NULL,
              step_id TEXT NOT NULL,
              order_index INTEGER NOT NULL,
              title TEXT NOT NULL,
              instruction_prompt TEXT NOT NULL,
              acceptance_criteria_json TEXT NOT NULL,
              required_evidence_json TEXT NOT NULL,
              remediation_prompt TEXT NOT NULL,
              context_refs_json TEXT NOT NULL,
              PRIMARY KEY (job_id, step_id),
              FOREIGN KEY (job_id) REFERENCES jobs(job_id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS attempts (
              attempt_id TEXT PRIMARY KEY,
              job_id TEXT NOT NULL,
              step_id TEXT NOT NULL,
              timestamp TEXT NOT NULL,
              model_claim TEXT NOT NULL,
              summary TEXT NOT NULL,
              evidence_json TEXT NOT NULL,
              outcome TEXT NOT NULL,
              rejection_reasons_json TEXT NOT NULL,
              missing_fields_json TEXT NOT NULL,
              devlog_line TEXT,
              commit_hash TEXT,
              FOREIGN KEY (job_id) REFERENCES jobs(job_id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS context_blocks (
              context_id TEXT PRIMARY KEY,
              job_id TEXT NOT NULL,
              block_type TEXT NOT NULL,
              content TEXT NOT NULL,
              tags_json TEXT NOT NULL,
              created_at TEXT NOT NULL,
              FOREIGN KEY (job_id) REFERENCES jobs(job_id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS logs (
              log_id TEXT PRIMARY KEY,
              job_id TEXT NOT NULL,
              log_type TEXT NOT NULL,
              content TEXT NOT NULL,
              created_at TEXT NOT NULL,
              step_id TEXT,
              commit_hash TEXT,
              FOREIGN KEY (job_id) REFERENCES jobs(job_id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS mistakes (
              mistake_id TEXT PRIMARY KEY,
              job_id TEXT NOT NULL,
              title TEXT NOT NULL,
              what_happened TEXT NOT NULL,
              why TEXT NOT NULL,
              lesson TEXT NOT NULL,
              avoid_next_time TEXT NOT NULL,
              tags_json TEXT NOT NULL,
              created_at TEXT NOT NULL,
              related_step_id TEXT,
              FOREIGN KEY (job_id) REFERENCES jobs(job_id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS repo_snapshots (
              snapshot_id TEXT PRIMARY KEY,
              job_id TEXT NOT NULL,
              timestamp TEXT NOT NULL,
              repo_root TEXT NOT NULL,
              file_tree TEXT NOT NULL,
              key_files_json TEXT NOT NULL,
              notes TEXT,
              FOREIGN KEY (job_id) REFERENCES jobs(job_id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS repo_map_entries (
              job_id TEXT NOT NULL,
              path TEXT NOT NULL,
              description TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              PRIMARY KEY (job_id, path),
              FOREIGN KEY (job_id) REFERENCES jobs(job_id) ON DELETE CASCADE
            );
            """
        )
        await self._ensure_jobs_columns(
            [
                ("deliverables_json", "TEXT"),
                ("invariants_json", "TEXT"),
                ("definition_of_done_json", "TEXT"),
                ("step_order_json", "TEXT"),
                ("current_step_index", "INTEGER DEFAULT 0"),
                ("planning_answers_json", "TEXT"),
            ]
        )
        await self._ensure_steps_columns(
            [
                ("expected_outputs_json", "TEXT"),
            ]
        )
        await self._conn.commit()

    async def _ensure_jobs_columns(self, columns: list[tuple[str, str]]) -> None:
        async with self._conn.execute("PRAGMA table_info(jobs);") as cursor:
            rows = await cursor.fetchall()
        existing = {row["name"] for row in rows}

        for name, decl in columns:
            if name in existing:
                continue
            await self._conn.execute(f"ALTER TABLE jobs ADD COLUMN {name} {decl};")

    async def _ensure_steps_columns(self, columns: list[tuple[str, str]]) -> None:
        async with self._conn.execute("PRAGMA table_info(steps);") as cursor:
            rows = await cursor.fetchall()
        existing = {row["name"] for row in rows}

        for name, decl in columns:
            if name in existing:
                continue
            await self._conn.execute(f"ALTER TABLE steps ADD COLUMN {name} {decl};")

    async def create_job(
        self,
        *,
        title: str,
        goal: str,
        repo_root: str | None,
        policies: dict[str, Any],
    ) -> str:
        job_id = _new_id("JOB")
        now = _utc_now_iso()
        await self._conn.execute(
            """
            INSERT INTO jobs (
              job_id, title, goal, status, created_at, updated_at, repo_root, policies_json,
              deliverables_json, invariants_json, definition_of_done_json,
              step_order_json, current_step_index, planning_answers_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """,
            (
                job_id,
                title,
                goal,
                "PLANNING",
                now,
                now,
                repo_root,
                json.dumps(policies),
                None,
                None,
                None,
                json.dumps([]),
                0,
                json.dumps({}),
            ),
        )
        await self._conn.commit()
        return job_id

    async def get_job(self, job_id: str) -> dict[str, Any]:
        async with self._conn.execute(
            "SELECT * FROM jobs WHERE job_id = ?;",
            (job_id,),
        ) as cursor:
            row = await cursor.fetchone()
        if row is None:
            raise KeyError(f"Unknown job_id: {job_id}")

        data = dict(row)
        data["policies"] = json.loads(data.pop("policies_json") or "{}")
        data["deliverables"] = json.loads(data.pop("deliverables_json") or "[]")
        invariants_json = data.pop("invariants_json")
        data["invariants"] = None if invariants_json is None else json.loads(invariants_json or "[]")
        data["definition_of_done"] = json.loads(data.pop("definition_of_done_json") or "[]")
        data["step_order"] = json.loads(data.pop("step_order_json") or "[]")
        data["planning_answers"] = json.loads(data.pop("planning_answers_json") or "{}")
        return data

    async def conductor_merge_answers(self, job_id: str, answers: dict[str, Any]) -> dict[str, Any]:
        job = await self.get_job(job_id)
        merged = dict(job.get("planning_answers") or {})
        merged.update(answers)

        repo_root = job.get("repo_root")
        if repo_root is None and isinstance(answers.get("repo_root"), str):
            repo_root = answers["repo_root"]

        await self._conn.execute(
            "UPDATE jobs SET planning_answers_json = ?, repo_root = ?, updated_at = ? WHERE job_id = ?;",
            (json.dumps(merged), repo_root, _utc_now_iso(), job_id),
        )
        await self._conn.commit()
        return merged

    async def context_add_block(
        self,
        *,
        job_id: str,
        block_type: str,
        content: str,
        tags: list[str],
    ) -> str:
        context_id = _new_id("CTX", length=6)
        await self._conn.execute(
            """
            INSERT INTO context_blocks (
              context_id, job_id, block_type, content, tags_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?);
            """,
            (context_id, job_id, block_type, content, json.dumps(tags), _utc_now_iso()),
        )
        await self._conn.commit()
        return context_id

    async def context_get_block(self, *, job_id: str, context_id: str) -> dict[str, Any]:
        async with self._conn.execute(
            "SELECT * FROM context_blocks WHERE job_id = ? AND context_id = ?;",
            (job_id, context_id),
        ) as cursor:
            row = await cursor.fetchone()
        if row is None:
            raise KeyError(f"Unknown context_id {context_id} for job {job_id}")
        data = dict(row)
        data["tags"] = json.loads(data.pop("tags_json") or "[]")
        return data

    async def context_search(self, *, job_id: str, query: str, limit: int = 20) -> list[dict[str, Any]]:
        like = f"%{query}%"
        async with self._conn.execute(
            """
            SELECT context_id, block_type, content, tags_json, created_at
            FROM context_blocks
            WHERE job_id = ?
              AND (block_type LIKE ? OR content LIKE ?)
            ORDER BY created_at DESC
            LIMIT ?;
            """,
            (job_id, like, like, limit),
        ) as cursor:
            rows = await cursor.fetchall()

        out: list[dict[str, Any]] = []
        for row in rows:
            item = dict(row)
            item["tags"] = json.loads(item.pop("tags_json") or "[]")
            item["excerpt"] = (item["content"][:200] + "...") if len(item["content"]) > 200 else item["content"]
            del item["content"]
            out.append(item)
        return out

    async def devlog_append(
        self,
        *,
        job_id: str,
        content: str,
        step_id: str | None = None,
        commit_hash: str | None = None,
        log_type: str = "DEVLOG",
    ) -> str:
        log_id = _new_id("LOG", length=6)
        await self._conn.execute(
            """
            INSERT INTO logs (
              log_id, job_id, log_type, content, created_at, step_id, commit_hash
            ) VALUES (?, ?, ?, ?, ?, ?, ?);
            """,
            (log_id, job_id, log_type, content, _utc_now_iso(), step_id, commit_hash),
        )
        await self._conn.commit()
        return log_id

    async def mistake_record(
        self,
        *,
        job_id: str,
        title: str,
        what_happened: str,
        why: str,
        lesson: str,
        avoid_next_time: str,
        tags: list[str],
        related_step_id: str | None = None,
    ) -> str:
        mistake_id = _new_id("MSK", length=6)
        await self._conn.execute(
            """
            INSERT INTO mistakes (
              mistake_id, job_id, title, what_happened, why, lesson, avoid_next_time,
              tags_json, created_at, related_step_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """,
            (
                mistake_id,
                job_id,
                title,
                what_happened,
                why,
                lesson,
                avoid_next_time,
                json.dumps(tags),
                _utc_now_iso(),
                related_step_id,
            ),
        )
        await self._conn.commit()
        return mistake_id

    async def mistake_list(self, *, job_id: str, limit: int = 50) -> list[dict[str, Any]]:
        async with self._conn.execute(
            """
            SELECT mistake_id, title, lesson, avoid_next_time, tags_json, created_at, related_step_id
            FROM mistakes
            WHERE job_id = ?
            ORDER BY created_at DESC
            LIMIT ?;
            """,
            (job_id, limit),
        ) as cursor:
            rows = await cursor.fetchall()
        out: list[dict[str, Any]] = []
        for row in rows:
            item = dict(row)
            item["tags"] = json.loads(item.pop("tags_json") or "[]")
            out.append(item)
        return out

    async def repo_snapshot(
        self,
        *,
        job_id: str,
        repo_root: str,
        notes: str | None = None,
    ) -> dict[str, Any]:
        file_tree, key_files = snapshot_file_tree(repo_root)
        snapshot_id = _new_id("SNP", length=6)
        await self._conn.execute(
            """
            INSERT INTO repo_snapshots (
              snapshot_id, job_id, timestamp, repo_root, file_tree, key_files_json, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?);
            """,
            (
                snapshot_id,
                job_id,
                _utc_now_iso(),
                repo_root,
                file_tree,
                json.dumps(key_files),
                notes,
            ),
        )
        await self._conn.commit()
        excerpt = "\n".join(file_tree.splitlines()[:200])
        return {"snapshot_id": snapshot_id, "file_tree_excerpt": excerpt, "key_files": key_files}

    async def repo_file_descriptions_update(self, *, job_id: str, updates: dict[str, str]) -> dict[str, Any]:
        now = _utc_now_iso()
        count = 0
        for path, description in updates.items():
            await self._conn.execute(
                """
                INSERT INTO repo_map_entries (job_id, path, description, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(job_id, path) DO UPDATE SET
                  description=excluded.description,
                  updated_at=excluded.updated_at;
                """,
                (job_id, path, description, now),
            )
            count += 1
        await self._conn.commit()
        return {"updated": count}

    async def repo_map_export(self, *, job_id: str, format: str = "md") -> dict[str, Any]:
        async with self._conn.execute(
            "SELECT path, description, updated_at FROM repo_map_entries WHERE job_id = ? ORDER BY path ASC;",
            (job_id,),
        ) as cursor:
            rows = await cursor.fetchall()
        entries = [dict(r) for r in rows]
        if format == "json":
            return {"format": "json", "entries": entries}

        lines = ["# Repo Map", ""]
        for e in entries:
            lines.append(f"- `{e['path']}` — {e['description']}")
        return {"format": "md", "content": "\n".join(lines)}

    async def repo_find_stale_candidates(self, *, job_id: str, max_results: int = 50) -> dict[str, Any]:
        job = await self.get_job(job_id)
        repo_root = job.get("repo_root")
        if not repo_root:
            raise ValueError("repo_root is not set for this job")
        candidates = find_stale_candidates(repo_root, max_results=max_results)
        return {"count": len(candidates), "items": candidates}

    async def job_export_bundle(self, *, job_id: str, format: str = "json") -> dict[str, Any]:
        job = await self.get_job(job_id)
        steps: list[dict[str, Any]] = []
        async with self._conn.execute(
            "SELECT * FROM steps WHERE job_id = ? ORDER BY order_index ASC;",
            (job_id,),
        ) as cursor:
            rows = await cursor.fetchall()
        for row in rows:
            step = dict(row)
            step["acceptance_criteria"] = json.loads(step.pop("acceptance_criteria_json") or "[]")
            step["required_evidence"] = json.loads(step.pop("required_evidence_json") or "[]")
            expected_outputs_json = step.pop("expected_outputs_json", None)
            step["expected_outputs"] = json.loads(expected_outputs_json or "[]") if expected_outputs_json else []
            step["context_refs"] = json.loads(step.pop("context_refs_json") or "[]")
            steps.append(step)

        if format == "md":
            lines = [
                f"# {job.get('title','(untitled)')} ({job_id})",
                "",
                f"Status: {job['status']}",
                "",
                "## Goal",
                job["goal"],
                "",
                "## Deliverables",
                *[f"- {d}" for d in job["deliverables"]],
                "",
                "## Steps",
            ]
            for s in steps:
                lines.extend(
                    [
                        f"### {s['step_id']}: {s['title']}",
                        s["instruction_prompt"],
                        "",
                    ]
                )
            return {"format": "md", "content": "\n".join(lines)}

        return {"format": "json", "job": job, "steps": steps}

    async def job_archive(self, *, job_id: str) -> None:
        await self._conn.execute(
            "UPDATE jobs SET status = 'ARCHIVED', updated_at = ? WHERE job_id = ?;",
            (_utc_now_iso(), job_id),
        )
        await self._conn.commit()

    async def plan_set_deliverables(self, job_id: str, deliverables: list[str]) -> None:
        await self._conn.execute(
            "UPDATE jobs SET deliverables_json = ?, updated_at = ? WHERE job_id = ?;",
            (json.dumps(deliverables), _utc_now_iso(), job_id),
        )
        await self._conn.commit()

    async def plan_set_invariants(self, job_id: str, invariants: list[str]) -> None:
        await self._conn.execute(
            "UPDATE jobs SET invariants_json = ?, updated_at = ? WHERE job_id = ?;",
            (json.dumps(invariants), _utc_now_iso(), job_id),
        )
        await self._conn.commit()

    async def plan_set_definition_of_done(self, job_id: str, definition_of_done: list[str]) -> None:
        await self._conn.execute(
            "UPDATE jobs SET definition_of_done_json = ?, updated_at = ? WHERE job_id = ?;",
            (json.dumps(definition_of_done), _utc_now_iso(), job_id),
        )
        await self._conn.commit()

    async def plan_propose_steps(self, job_id: str, steps: list[dict[str, Any]]) -> list[dict[str, Any]]:
        normalized: list[dict[str, Any]] = []
        step_ids: list[str] = []

        # Replace the full step list atomically.
        await self._conn.execute("DELETE FROM steps WHERE job_id = ?;", (job_id,))

        for idx, step in enumerate(steps, start=1):
            step_id = step.get("step_id") or f"S{idx}"
            step_ids.append(step_id)
            normalized_step = {
                "step_id": step_id,
                "title": step["title"],
                "instruction_prompt": step["instruction_prompt"],
                "acceptance_criteria": step.get("acceptance_criteria", []),
                "required_evidence": step.get("required_evidence", []),
                "expected_outputs": step.get("expected_outputs", []),
                "remediation_prompt": step.get("remediation_prompt", ""),
                "context_refs": step.get("context_refs", []),
            }
            normalized.append(normalized_step)

            await self._conn.execute(
                """
                INSERT INTO steps (
                  job_id, step_id, order_index, title, instruction_prompt,
                  acceptance_criteria_json, required_evidence_json,
                  expected_outputs_json, remediation_prompt, context_refs_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    job_id,
                    step_id,
                    idx - 1,
                    normalized_step["title"],
                    normalized_step["instruction_prompt"],
                    json.dumps(normalized_step["acceptance_criteria"]),
                    json.dumps(normalized_step["required_evidence"]),
                    json.dumps(normalized_step["expected_outputs"]),
                    normalized_step["remediation_prompt"],
                    json.dumps(normalized_step["context_refs"]),
                ),
            )

        await self._conn.execute(
            "UPDATE jobs SET step_order_json = ?, current_step_index = 0, updated_at = ? WHERE job_id = ?;",
            (json.dumps(step_ids), _utc_now_iso(), job_id),
        )
        await self._conn.commit()
        return normalized

    async def _count_steps(self, job_id: str) -> int:
        async with self._conn.execute("SELECT COUNT(1) AS n FROM steps WHERE job_id = ?;", (job_id,)) as cursor:
            row = await cursor.fetchone()
        return int(row["n"] if row else 0)

    async def _get_step(self, job_id: str, step_id: str) -> dict[str, Any]:
        async with self._conn.execute(
            "SELECT * FROM steps WHERE job_id = ? AND step_id = ?;",
            (job_id, step_id),
        ) as cursor:
            row = await cursor.fetchone()
        if row is None:
            raise KeyError(f"Unknown step_id {step_id} for job {job_id}")

        data = dict(row)
        data["acceptance_criteria"] = json.loads(data.pop("acceptance_criteria_json") or "[]")
        data["required_evidence"] = json.loads(data.pop("required_evidence_json") or "[]")
        expected_outputs_json = data.pop("expected_outputs_json", None)
        data["expected_outputs"] = json.loads(expected_outputs_json or "[]") if expected_outputs_json else []
        data["context_refs"] = json.loads(data.pop("context_refs_json") or "[]")
        return data

    async def job_set_ready(self, job_id: str) -> dict[str, Any]:
        job = await self.get_job(job_id)
        missing: list[str] = []

        if not job["deliverables"]:
            missing.append("deliverables")
        if job["invariants"] is None:
            missing.append("invariants")
        if not job["definition_of_done"]:
            missing.append("definition_of_done")

        step_count = await self._count_steps(job_id)
        if step_count < 1:
            missing.append("steps")

        if missing:
            return {"ready": False, "missing": missing}

        await self._conn.execute(
            "UPDATE jobs SET status = 'READY', updated_at = ? WHERE job_id = ?;",
            (_utc_now_iso(), job_id),
        )
        await self._conn.commit()
        job = await self.get_job(job_id)
        return {"ready": True, "missing": [], "job": job}

    async def job_start(self, job_id: str) -> dict[str, Any]:
        job = await self.get_job(job_id)
        if job["status"] not in {"READY", "EXECUTING"}:
            raise ValueError(f"Job {job_id} is not READY/EXECUTING (status={job['status']})")

        if job["status"] == "READY":
            await self._conn.execute(
                "UPDATE jobs SET status = 'EXECUTING', updated_at = ? WHERE job_id = ?;",
                (_utc_now_iso(), job_id),
            )
            await self._conn.commit()

        return {"ok": True, "job_id": job_id}

    async def job_next_step_prompt(self, job_id: str) -> dict[str, Any]:
        job = await self.get_job(job_id)
        if job["status"] != "EXECUTING":
            raise ValueError(f"Job {job_id} is not EXECUTING (status={job['status']})")

        step_order: list[str] = job["step_order"]
        idx = int(job.get("current_step_index") or 0)
        if idx < 0 or idx >= len(step_order):
            raise ValueError(f"Job {job_id} has no active step (index={idx}, steps={len(step_order)})")

        step_id = step_order[idx]
        step = await self._get_step(job_id, step_id)

        required_evidence = {"required": list(step["required_evidence"])}
        invariants = job["invariants"] if job["invariants"] is not None else []

        policies = job.get("policies") or {}
        relevant_mistakes: list[str] = []
        if policies.get("inject_mistakes_every_step"):
            async with self._conn.execute(
                """
                SELECT title, avoid_next_time
                FROM mistakes
                WHERE job_id = ?
                ORDER BY created_at DESC
                LIMIT 3;
                """,
                (job_id,),
            ) as cursor:
                rows = await cursor.fetchall()
            for r in rows:
                relevant_mistakes.append(f"{r['title']}: {r['avoid_next_time']}")

        evidence_template: dict[str, Any] = {}
        required_keys = set(required_evidence["required"])
        if policies.get("require_diff_summary"):
            required_keys.add("diff_summary")
        if policies.get("require_tests_evidence"):
            required_keys.add("tests_run")
            required_keys.add("tests_passed")
        if policies.get("require_devlog_per_step"):
            required_keys.add("devlog_line")
        if policies.get("require_commit_per_step"):
            required_keys.add("commit_hash")

        # Provide a standard template (even if not all keys are required).
        evidence_template["changed_files"] = ["..."]
        evidence_template["diff_summary"] = "..."
        evidence_template["commands_run"] = ["..."]
        evidence_template["tests_run"] = ["..."]
        evidence_template["tests_passed"] = True
        evidence_template["lint_run"] = False
        evidence_template["lint_passed"] = None
        evidence_template["artifacts_created"] = ["..."]
        if step.get("acceptance_criteria"):
            evidence_template["criteria_checklist"] = {f"c{i}": True for i in range(1, len(step["acceptance_criteria"]) + 1)}
        else:
            evidence_template["criteria_checklist"] = {}
        evidence_template["notes"] = "..."

        what_to_produce = list(step.get("expected_outputs") or [])
        if not what_to_produce:
            what_to_produce = ["(Use the instruction prompt + acceptance criteria as the scope for this step.)"]

        remediation = step.get("remediation_prompt") or "If stuck: reduce scope, revert unrelated changes, fix minimally, rerun checks, and resubmit evidence."

        prompt = "\n".join(
            [
                "1) Step Objective",
                f"{step_id}: {step['title']}",
                "",
                step["instruction_prompt"],
                "",
                "2) Non-Negotiable Invariants",
                *([f"- {i}" for i in invariants] if invariants else ["- (none)"]),
                "",
                "3) What to Produce",
                *[f"- {o}" for o in what_to_produce],
                "",
                "4) Acceptance Criteria",
                *([f"- {c}" for c in step["acceptance_criteria"]] if step["acceptance_criteria"] else ["- (none)"]),
                "",
                "5) Required Evidence Format",
                f"- required keys: {', '.join(sorted(required_keys)) if required_keys else '(none)'}",
                "Fill this JSON-like object and submit it via job_submit_step_result.evidence:",
                json.dumps(evidence_template, indent=2),
                "",
                "6) Reminder of Relevant Mistakes",
                *([f"- {m}" for m in relevant_mistakes] if relevant_mistakes else ["- (none)"]),
                "",
                "7) If Stuck",
                remediation,
                "",
                "Executor directive: perform ONLY this step, then submit evidence. If any criterion is false, do NOT claim MET.",
            ]
        )

        return {
            "step_id": step_id,
            "prompt": prompt,
            "acceptance_criteria": step["acceptance_criteria"],
            "required_evidence": required_evidence,
            "invariants": invariants,
            "relevant_mistakes": relevant_mistakes,
            "required_evidence_template": evidence_template,
        }

    async def job_submit_step_result(
        self,
        *,
        job_id: str,
        step_id: str,
        model_claim: str,
        summary: str,
        evidence: dict[str, Any],
        devlog_line: str | None,
        commit_hash: str | None,
    ) -> dict[str, Any]:
        job = await self.get_job(job_id)
        if job["status"] != "EXECUTING":
            raise ValueError(f"Job {job_id} is not EXECUTING (status={job['status']})")

        expected_step_id = job["step_order"][int(job.get("current_step_index") or 0)]
        if step_id != expected_step_id:
            raise ValueError(f"Job {job_id} expects step {expected_step_id}, got {step_id}")

        step = await self._get_step(job_id, step_id)
        required = list(step["required_evidence"])
        missing_fields = [k for k in required if k not in evidence]

        policies = job.get("policies") or {}
        if policies.get("require_devlog_per_step") and not devlog_line:
            missing_fields.append("devlog_line")
        if policies.get("require_commit_per_step") and not commit_hash:
            missing_fields.append("commit_hash")
        if policies.get("require_diff_summary") and "diff_summary" not in evidence:
            missing_fields.append("diff_summary")
        if policies.get("require_tests_evidence"):
            if "tests_run" not in evidence:
                missing_fields.append("tests_run")
            if "tests_passed" not in evidence:
                missing_fields.append("tests_passed")

        rejection_reasons: list[str] = []

        evidence_schema_mode = policies.get("evidence_schema_mode") or "loose"
        criteria_checklist_required = (
            evidence_schema_mode == "strict" and bool(step.get("acceptance_criteria"))
        )
        criteria_checklist_all_true = True
        if criteria_checklist_required:
            raw = evidence.get("criteria_checklist")
            if not isinstance(raw, dict):
                missing_fields.append("criteria_checklist")
            else:
                expected_keys = [f"c{i}" for i in range(1, len(step.get("acceptance_criteria", [])) + 1)]
                for k in expected_keys:
                    if k not in raw:
                        missing_fields.append("criteria_checklist")
                        break
                else:
                    # All expected keys present; require all true.
                    for k in expected_keys:
                        if raw.get(k) is not True:
                            criteria_checklist_all_true = False
                            break

        accepted = False
        next_action = "RETRY"
        if missing_fields:
            rejection_reasons.append("Missing required evidence keys.")
        elif criteria_checklist_required and not criteria_checklist_all_true:
            rejection_reasons.append("One or more acceptance criteria were marked false.")
        elif model_claim != "MET":
            rejection_reasons.append("Model claim is not MET.")
        else:
            accepted = True

        if accepted:
            idx = int(job.get("current_step_index") or 0) + 1
            if idx >= len(job["step_order"]):
                next_action = "JOB_COMPLETE"
                await self._conn.execute(
                    "UPDATE jobs SET current_step_index = ?, status = 'COMPLETE', updated_at = ? WHERE job_id = ?;",
                    (idx, _utc_now_iso(), job_id),
                )
            else:
                next_action = "NEXT_STEP_AVAILABLE"
                await self._conn.execute(
                    "UPDATE jobs SET current_step_index = ?, updated_at = ? WHERE job_id = ?;",
                    (idx, _utc_now_iso(), job_id),
                )
            await self._conn.commit()

        attempt_id = _new_id("ATT", length=6)
        await self._conn.execute(
            """
            INSERT INTO attempts (
              attempt_id, job_id, step_id, timestamp, model_claim, summary,
              evidence_json, outcome, rejection_reasons_json, missing_fields_json,
              devlog_line, commit_hash
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """,
            (
                attempt_id,
                job_id,
                step_id,
                _utc_now_iso(),
                model_claim,
                summary,
                json.dumps(evidence),
                "accepted" if accepted else "rejected",
                json.dumps(rejection_reasons),
                json.dumps(missing_fields),
                devlog_line,
                commit_hash,
            ),
        )
        await self._conn.commit()

        return {
            "accepted": accepted,
            "feedback": "OK" if accepted else "Rejected",
            "next_action": next_action,
            "missing_fields": missing_fields,
            "rejection_reasons": rejection_reasons,
        }
