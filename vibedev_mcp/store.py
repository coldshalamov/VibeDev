"""VibeDev persistent storage layer.

This module provides the VibeDevStore class which handles all database
operations for jobs, steps, attempts, context blocks, logs, mistakes,
and repository snapshots.
"""

from __future__ import annotations

import asyncio
import json
import re
import secrets
import string
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from pathlib import PurePosixPath
from typing import Any

import aiosqlite

from vibedev_mcp.repo import find_stale_candidates, snapshot_file_tree


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id(prefix: str, length: int = 4) -> str:
    alphabet = string.ascii_uppercase + string.digits
    suffix = "".join(secrets.choice(alphabet) for _ in range(length))
    return f"{prefix}-{suffix}"


def _normalize_relpath(path: str) -> str:
    return path.replace("\\", "/").lstrip("./")


def _matches_any_glob(path: str, patterns: list[str]) -> bool:
    p = PurePosixPath(_normalize_relpath(path))
    return any(p.match(pattern) for pattern in patterns)


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
                ("failure_reason", "TEXT"),
            ]
        )
        await self._ensure_steps_columns(
            [
                ("expected_outputs_json", "TEXT"),
                ("gates_json", "TEXT"),
                ("human_approved", "INTEGER DEFAULT 0"),
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
            gates_json = step.pop("gates_json", None)
            step["gates"] = json.loads(gates_json or "[]") if gates_json else []
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
                "gates": step.get("gates", []),
            }
            normalized.append(normalized_step)

            await self._conn.execute(
                """
                INSERT INTO steps (
                  job_id, step_id, order_index, title, instruction_prompt, 
                  acceptance_criteria_json, required_evidence_json,        
                  expected_outputs_json, remediation_prompt, context_refs_json,
                  gates_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
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
                    json.dumps(normalized_step["gates"]),
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
        gates_json = data.pop("gates_json", None)
        data["gates"] = json.loads(gates_json or "[]") if gates_json else []
        return data

    async def _count_rejected_attempts(self, *, job_id: str, step_id: str) -> int:
        async with self._conn.execute(
            """
            SELECT COUNT(1) AS n
            FROM attempts
            WHERE job_id = ? AND step_id = ? AND outcome = 'rejected';
            """,
            (job_id, step_id),
        ) as cursor:
            row = await cursor.fetchone()
        return int(row["n"] if row else 0)

    async def _evaluate_step_gates(
        self,
        *,
        job_id: str,
        step: dict[str, Any],
        evidence: dict[str, Any],
    ) -> list[str]:
        gates = step.get("gates") or []
        if not gates:
            return []
        if not isinstance(gates, list):
            return ["Gate evaluation failed: step.gates is not a list."]

        job = await self.get_job(job_id)
        git_status = None
        changed_files_from_git: list[str] | None = None
        if job.get("repo_root"):
            try:
                git_status = await self.git_status(job_id=job_id)
                if git_status.get("ok"):
                    changed_files_from_git = [
                        *git_status.get("modified", []),
                        *git_status.get("added", []),
                        *git_status.get("deleted", []),
                    ]
            except Exception:
                git_status = None
                changed_files_from_git = None

        failures: list[str] = []
        for gate in gates:
            if not isinstance(gate, dict):
                failures.append("Gate evaluation failed: invalid gate entry (must be an object).")
                continue

            gate_type = gate.get("type")
            params = gate.get("parameters") or {}

            if gate_type == "tests_passed":
                if evidence.get("tests_passed") is not True:
                    failures.append("Gate tests_passed failed: evidence.tests_passed is not true.")
                if "tests_run" not in evidence:
                    failures.append("Gate tests_passed failed: missing evidence.tests_run.")

            elif gate_type == "lint_passed":
                if evidence.get("lint_passed") is not True:
                    failures.append("Gate lint_passed failed: evidence.lint_passed is not true.")

            elif gate_type == "criteria_checklist_complete":
                raw = evidence.get("criteria_checklist")
                if not isinstance(raw, dict):
                    failures.append("Gate criteria_checklist_complete failed: evidence.criteria_checklist missing.")
                else:
                    expected = step.get("acceptance_criteria") or []
                    expected_keys = [f"c{i}" for i in range(1, len(expected) + 1)]
                    missing = [k for k in expected_keys if k not in raw]
                    if missing:
                        failures.append(
                            "Gate criteria_checklist_complete failed: missing checklist keys "
                            + ", ".join(missing)
                            + "."
                        )
                    else:
                        # Require all criteria (and any extra keys) to be true.
                        for _, v in raw.items():
                            if v is not True:
                                failures.append(
                                    "Gate criteria_checklist_complete failed: one or more criteria are false."
                                )
                                break

            elif gate_type in {"changed_files_allowlist", "forbid_paths"}:
                patterns = params.get("allowed") if gate_type == "changed_files_allowlist" else params.get("paths")
                if not isinstance(patterns, list) or not all(isinstance(p, str) for p in patterns):
                    failures.append(
                        f"Gate {gate_type} misconfigured: parameters must include a list of glob patterns."
                    )
                    continue

                changed = changed_files_from_git
                if changed is None:
                    raw = evidence.get("changed_files")
                    if not isinstance(raw, list) or not all(isinstance(p, str) for p in raw):
                        failures.append(
                            f"Gate {gate_type} failed: evidence.changed_files must be a list of paths."
                        )
                        continue
                    changed = raw

                if gate_type == "changed_files_allowlist":
                    offenders = [p for p in changed if not _matches_any_glob(p, patterns)]
                    if offenders:
                        failures.append(
                            f"Gate changed_files_allowlist failed (allowlist): files outside allowlist: {', '.join(offenders)}"
                        )
                else:
                    offenders = [p for p in changed if _matches_any_glob(p, patterns)]
                    if offenders:
                        failures.append(
                            f"Gate forbid_paths failed: forbidden paths touched: {', '.join(offenders)}"
                        )

            elif gate_type == "changed_files_minimum":
                patterns = params.get("paths")
                min_count = params.get("min_count", 1)
                if not isinstance(patterns, list) or not all(isinstance(p, str) for p in patterns):
                    failures.append(
                        "Gate changed_files_minimum misconfigured: parameters.paths must be a list of glob patterns."
                    )
                    continue
                if not isinstance(min_count, int) or min_count < 0:
                    failures.append(
                        "Gate changed_files_minimum misconfigured: parameters.min_count must be a non-negative int."
                    )
                    continue

                changed = changed_files_from_git
                if changed is None:
                    raw = evidence.get("changed_files")
                    if not isinstance(raw, list) or not all(isinstance(p, str) for p in raw):
                        failures.append(
                            "Gate changed_files_minimum failed: evidence.changed_files must be a list of paths."
                        )
                        continue
                    changed = raw

                matched = 0
                for pat in patterns:
                    if any(_matches_any_glob(p, [pat]) for p in changed):
                        matched += 1
                if matched < min_count:
                    failures.append(
                        f"Gate changed_files_minimum failed: matched {matched} paths, need at least {min_count}."
                    )

            elif gate_type in {"file_exists", "file_not_exists"}:
                if not job.get("repo_root"):
                    failures.append(f"Gate {gate_type} failed: job.repo_root is not set.")
                    continue

                rel = params.get("path")
                if not isinstance(rel, str) or not rel.strip():
                    failures.append(f"Gate {gate_type} misconfigured: parameters.path must be a non-empty string.")
                    continue

                repo_root_path = Path(job["repo_root"]).resolve()
                target = (repo_root_path / rel).resolve()
                try:
                    target.relative_to(repo_root_path)
                except ValueError:
                    failures.append(
                        f"Gate {gate_type} misconfigured: path must be within repo_root (got {rel!r})."
                    )
                    continue

                exists = target.exists()
                if gate_type == "file_exists" and not exists:
                    failures.append(f"Gate file_exists failed: missing {rel!r}.")
                if gate_type == "file_not_exists" and exists:
                    failures.append(f"Gate file_not_exists failed: {rel!r} exists.")

            elif gate_type == "no_uncommitted_changes":
                if not job.get("repo_root"):
                    failures.append("Gate no_uncommitted_changes failed: job.repo_root is not set.")
                elif not git_status or not git_status.get("ok"):
                    failures.append("Gate no_uncommitted_changes failed: could not get git status.")
                elif not git_status.get("clean", False):
                    failures.append("Gate no_uncommitted_changes failed: working tree is not clean.")

            elif gate_type in {"diff_max_lines", "diff_min_lines"}:       
                if not job.get("repo_root"):
                    failures.append(f"Gate {gate_type} failed: job.repo_root is not set.")
                    continue

                bound_key = "max" if gate_type == "diff_max_lines" else "min"
                bound = params.get(bound_key)
                if not isinstance(bound, int) or bound < 0:
                    failures.append(f"Gate {gate_type} misconfigured: parameters.{bound_key} must be a non-negative int.")
                    continue

                def _numstat_total(output: str) -> int:
                    total = 0
                    for line in output.splitlines():
                        parts = line.split("\t")
                        if len(parts) < 2:
                            continue
                        try:
                            added = int(parts[0]) if parts[0].isdigit() else 0
                            deleted = int(parts[1]) if parts[1].isdigit() else 0
                            total += added + deleted
                        except ValueError:
                            continue
                    return total

                try:
                    totals: list[int] = []
                    for cmd in (["git", "diff", "--numstat"], ["git", "diff", "--numstat", "--staged"]):
                        result = subprocess.run(
                            cmd,
                            cwd=job["repo_root"],
                            capture_output=True,
                            text=True,
                            timeout=30,
                        )
                        if result.returncode != 0:
                            failures.append(f"Gate {gate_type} failed: git diff failed.")
                            totals = []
                            break
                        totals.append(_numstat_total(result.stdout))
                    if not totals:
                        continue
                    total = sum(totals)
                    if gate_type == "diff_max_lines" and total > bound:
                        failures.append(
                            f"Gate diff_max_lines failed: {total} changed lines exceeds max {bound}."
                        )
                    if gate_type == "diff_min_lines" and total < bound:
                        failures.append(
                            f"Gate diff_min_lines failed: {total} changed lines below min {bound}."
                        )
                except Exception:
                    failures.append(f"Gate {gate_type} failed: could not compute diff stats.")

            elif gate_type == "patch_applies_cleanly":
                if not job.get("repo_root"):
                    failures.append("Gate patch_applies_cleanly failed: job.repo_root is not set.")
                    continue

                patch = params.get("patch")
                if not isinstance(patch, str) or not patch.strip():
                    failures.append(
                        "Gate patch_applies_cleanly misconfigured: parameters.patch must be a non-empty string."
                    )
                    continue

                try:
                    result = subprocess.run(
                        ["git", "apply", "--check", "--whitespace=nowarn", "-"],
                        cwd=job["repo_root"],
                        capture_output=True,
                        text=True,
                        input=patch,
                        timeout=30,
                    )
                    if result.returncode != 0:
                        failures.append(
                            "Gate patch_applies_cleanly failed: patch does not apply cleanly."
                        )
                except Exception:
                    failures.append(
                        "Gate patch_applies_cleanly failed: could not validate patch."
                    )

            elif gate_type == "command_exit_0":
                # Run a shell command and check that exit code is 0
                command = params.get("command")
                if not isinstance(command, str) or not command.strip():
                    failures.append(
                        "Gate command_exit_0 misconfigured: parameters.command must be a non-empty string."
                    )
                    continue

                timeout_secs = params.get("timeout", 60)
                if not isinstance(timeout_secs, (int, float)) or timeout_secs <= 0:
                    timeout_secs = 60
                timeout_secs = min(timeout_secs, 300)  # Max 5 minutes

                cwd = job.get("repo_root") or None
                try:
                    result = subprocess.run(
                        command,
                        shell=True,
                        cwd=cwd,
                        capture_output=True,
                        text=True,
                        timeout=timeout_secs,
                    )
                    if result.returncode != 0:
                        stderr_snippet = (result.stderr or "")[:500]
                        failures.append(
                            f"Gate command_exit_0 failed: command returned exit code {result.returncode}. "
                            f"stderr: {stderr_snippet}"
                        )
                except subprocess.TimeoutExpired:
                    failures.append(
                        f"Gate command_exit_0 failed: command timed out after {timeout_secs}s."
                    )
                except Exception as e:
                    failures.append(f"Gate command_exit_0 failed: {e}")

            elif gate_type == "command_output_contains":
                # Run a shell command and check that output contains a substring
                command = params.get("command")
                contains = params.get("contains")
                if not isinstance(command, str) or not command.strip():
                    failures.append(
                        "Gate command_output_contains misconfigured: parameters.command must be a non-empty string."
                    )
                    continue
                if not isinstance(contains, str):
                    failures.append(
                        "Gate command_output_contains misconfigured: parameters.contains must be a string."
                    )
                    continue

                timeout_secs = params.get("timeout", 60)
                if not isinstance(timeout_secs, (int, float)) or timeout_secs <= 0:
                    timeout_secs = 60
                timeout_secs = min(timeout_secs, 300)

                case_insensitive = params.get("case_insensitive", False)
                cwd = job.get("repo_root") or None
                try:
                    result = subprocess.run(
                        command,
                        shell=True,
                        cwd=cwd,
                        capture_output=True,
                        text=True,
                        timeout=timeout_secs,
                    )
                    combined_output = (result.stdout or "") + (result.stderr or "")
                    if case_insensitive:
                        found = contains.lower() in combined_output.lower()
                    else:
                        found = contains in combined_output
                    if not found:
                        failures.append(
                            f"Gate command_output_contains failed: output does not contain {contains!r}."
                        )
                except subprocess.TimeoutExpired:
                    failures.append(
                        f"Gate command_output_contains failed: command timed out after {timeout_secs}s."
                    )
                except Exception as e:
                    failures.append(f"Gate command_output_contains failed: {e}")

            elif gate_type == "command_output_regex":
                # Run a shell command and check that output matches a regex pattern
                command = params.get("command")
                pattern = params.get("pattern")
                if not isinstance(command, str) or not command.strip():
                    failures.append(
                        "Gate command_output_regex misconfigured: parameters.command must be a non-empty string."
                    )
                    continue
                if not isinstance(pattern, str):
                    failures.append(
                        "Gate command_output_regex misconfigured: parameters.pattern must be a string."
                    )
                    continue

                try:
                    compiled_pattern = re.compile(pattern)
                except re.error as e:
                    failures.append(
                        f"Gate command_output_regex misconfigured: invalid regex pattern: {e}"
                    )
                    continue

                timeout_secs = params.get("timeout", 60)
                if not isinstance(timeout_secs, (int, float)) or timeout_secs <= 0:
                    timeout_secs = 60
                timeout_secs = min(timeout_secs, 300)

                cwd = job.get("repo_root") or None
                try:
                    result = subprocess.run(
                        command,
                        shell=True,
                        cwd=cwd,
                        capture_output=True,
                        text=True,
                        timeout=timeout_secs,
                    )
                    combined_output = (result.stdout or "") + (result.stderr or "")
                    if not compiled_pattern.search(combined_output):
                        failures.append(
                            f"Gate command_output_regex failed: output does not match pattern {pattern!r}."
                        )
                except subprocess.TimeoutExpired:
                    failures.append(
                        f"Gate command_output_regex failed: command timed out after {timeout_secs}s."
                    )
                except Exception as e:
                    failures.append(f"Gate command_output_regex failed: {e}")

            elif gate_type == "json_schema_valid":
                # Validate a JSON file against a schema
                if not job.get("repo_root"):
                    failures.append("Gate json_schema_valid failed: job.repo_root is not set.")
                    continue

                file_path = params.get("path")
                schema = params.get("schema")
                if not isinstance(file_path, str) or not file_path.strip():
                    failures.append(
                        "Gate json_schema_valid misconfigured: parameters.path must be a non-empty string."
                    )
                    continue
                if not isinstance(schema, dict):
                    failures.append(
                        "Gate json_schema_valid misconfigured: parameters.schema must be a JSON schema object."
                    )
                    continue

                repo_root_path = Path(job["repo_root"]).resolve()
                target = (repo_root_path / file_path).resolve()
                try:
                    target.relative_to(repo_root_path)
                except ValueError:
                    failures.append(
                        f"Gate json_schema_valid misconfigured: path must be within repo_root (got {file_path!r})."
                    )
                    continue

                if not target.exists():
                    failures.append(f"Gate json_schema_valid failed: file {file_path!r} does not exist.")
                    continue

                try:
                    with open(target, "r", encoding="utf-8") as f:
                        data = json.load(f)
                except json.JSONDecodeError as e:
                    failures.append(f"Gate json_schema_valid failed: invalid JSON in {file_path!r}: {e}")
                    continue
                except Exception as e:
                    failures.append(f"Gate json_schema_valid failed: could not read {file_path!r}: {e}")
                    continue

                # Simple schema validation (type checking for common cases)
                # For full JSON Schema validation, would need jsonschema library
                schema_type = schema.get("type")
                if schema_type:
                    type_map = {
                        "object": dict,
                        "array": list,
                        "string": str,
                        "number": (int, float),
                        "integer": int,
                        "boolean": bool,
                        "null": type(None),
                    }
                    expected_type = type_map.get(schema_type)
                    if expected_type and not isinstance(data, expected_type):
                        failures.append(
                            f"Gate json_schema_valid failed: expected {schema_type}, got {type(data).__name__}."
                        )
                        continue

                # Check required properties for objects
                if schema_type == "object" and isinstance(data, dict):
                    required = schema.get("required", [])
                    if isinstance(required, list):
                        missing = [k for k in required if k not in data]
                        if missing:
                            failures.append(
                                f"Gate json_schema_valid failed: missing required properties: {', '.join(missing)}."
                            )

            elif gate_type == "human_approval":
                # Check if human has explicitly approved this step
                # This gate always fails during automated evaluation
                # It requires explicit approval via approve_step() call
                description = params.get("description", "Human approval required")

                # Check if there's an approval record for this step
                # The approval is stored as a flag on the step itself
                step_id = step.get("step_id")
                if step_id:
                    cursor = await self._conn.execute(
                        "SELECT human_approved FROM steps WHERE job_id = ? AND step_id = ?;",
                        (job_id, step_id),
                    )
                    row = await cursor.fetchone()
                    if row and row[0]:
                        # Human has approved
                        pass
                    else:
                        failures.append(
                            f"Gate human_approval failed: {description}. "
                            "Use approve_step() to grant approval."
                        )
                else:
                    failures.append("Gate human_approval failed: could not determine step_id.")

            else:
                failures.append(f"Unknown gate type: {gate_type!r}.")     

        return failures

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
        if policies.get("evidence_schema_mode") == "strict" and bool(step.get("acceptance_criteria")):
            required_keys.add("criteria_checklist")

        required_evidence["required"] = sorted(required_keys)

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
        evidence_template["devlog_line"] = "..."
        evidence_template["commit_hash"] = "..."

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
        previous_rejections = await self._count_rejected_attempts(        
            job_id=job_id,
            step_id=step_id,
        )
        required_keys = set(step.get("required_evidence") or [])

        policies = job.get("policies") or {}
        evidence_schema_mode = policies.get("evidence_schema_mode") or "loose"
        criteria_checklist_required = (
            evidence_schema_mode == "strict" and bool(step.get("acceptance_criteria"))
        )

        if policies.get("require_diff_summary"):
            required_keys.add("diff_summary")
        if policies.get("require_tests_evidence"):
            required_keys.add("tests_run")
            required_keys.add("tests_passed")
        if criteria_checklist_required:
            required_keys.add("criteria_checklist")

        missing_fields: list[str] = []
        schema_errors: list[str] = []

        def _add_missing(key: str) -> None:
            if key not in missing_fields:
                missing_fields.append(key)

        # Allow evidence to carry these if not provided as explicit params.
        if devlog_line is None and "devlog_line" in evidence:
            if isinstance(evidence.get("devlog_line"), str):
                devlog_line = evidence["devlog_line"]
            else:
                _add_missing("devlog_line")
                schema_errors.append("evidence.devlog_line must be a string.")
        if commit_hash is None and "commit_hash" in evidence:
            if isinstance(evidence.get("commit_hash"), str):
                commit_hash = evidence["commit_hash"]
            else:
                _add_missing("commit_hash")
                schema_errors.append("evidence.commit_hash must be a string.")

        # Missing required evidence keys.
        for k in sorted(required_keys):
            if k not in evidence:
                _add_missing(k)

        def _is_list_of_str(v: Any) -> bool:
            return isinstance(v, list) and all(isinstance(x, str) for x in v)

        def _is_dict_str_bool(v: Any) -> bool:
            return (
                isinstance(v, dict)
                and all(isinstance(k, str) for k in v.keys())
                and all(isinstance(x, bool) for x in v.values())
            )

        # Basic type validation for common EvidenceSchema keys.
        if "changed_files" in required_keys and "changed_files" in evidence:
            if not _is_list_of_str(evidence.get("changed_files")):
                _add_missing("changed_files")
                schema_errors.append("evidence.changed_files must be a list of strings.")
        if "commands_run" in required_keys and "commands_run" in evidence:
            if not _is_list_of_str(evidence.get("commands_run")):
                _add_missing("commands_run")
                schema_errors.append("evidence.commands_run must be a list of strings.")
        if "tests_run" in required_keys and "tests_run" in evidence:
            if not _is_list_of_str(evidence.get("tests_run")):
                _add_missing("tests_run")
                schema_errors.append("evidence.tests_run must be a list of strings.")
        if "tests_passed" in required_keys and "tests_passed" in evidence:
            if not isinstance(evidence.get("tests_passed"), bool):
                _add_missing("tests_passed")
                schema_errors.append("evidence.tests_passed must be a boolean.")
        if "lint_run" in required_keys and "lint_run" in evidence:
            if not isinstance(evidence.get("lint_run"), bool):
                _add_missing("lint_run")
                schema_errors.append("evidence.lint_run must be a boolean.")
        if "lint_passed" in required_keys and "lint_passed" in evidence:
            lint_passed = evidence.get("lint_passed")
            if lint_passed is not None and not isinstance(lint_passed, bool):
                _add_missing("lint_passed")
                schema_errors.append("evidence.lint_passed must be a boolean or null.")
        if "artifacts_created" in required_keys and "artifacts_created" in evidence:
            if not _is_list_of_str(evidence.get("artifacts_created")):
                _add_missing("artifacts_created")
                schema_errors.append("evidence.artifacts_created must be a list of strings.")
        if "criteria_checklist" in required_keys and "criteria_checklist" in evidence:
            if not _is_dict_str_bool(evidence.get("criteria_checklist")):
                _add_missing("criteria_checklist")
                schema_errors.append("evidence.criteria_checklist must be an object of booleans.")

        if policies.get("require_devlog_per_step") and not devlog_line:   
            _add_missing("devlog_line")
        if policies.get("require_commit_per_step") and not commit_hash:   
            _add_missing("commit_hash")
 
        rejection_reasons: list[str] = []
        criteria_checklist_all_true = True
        if criteria_checklist_required:
            raw = evidence.get("criteria_checklist")
            if not isinstance(raw, dict):
                _add_missing("criteria_checklist")
            else:
                expected_keys = [f"c{i}" for i in range(1, len(step.get("acceptance_criteria", [])) + 1)]
                for k in expected_keys:
                    if k not in raw:
                        _add_missing("criteria_checklist")
                        schema_errors.append(
                            "evidence.criteria_checklist must include keys c1..cN."
                        )
                        break
                else:
                    # All expected keys present; require all true.        
                    for k in expected_keys:
                        if raw.get(k) is not True:
                            criteria_checklist_all_true = False
                            break

        gate_failures: list[str] = []
        if not missing_fields and not (
            criteria_checklist_required and not criteria_checklist_all_true
        ):
            gate_failures = await self._evaluate_step_gates(
                job_id=job_id,
                step=step,
                evidence=evidence,
            )

        accepted = False
        next_action = "RETRY"
        if missing_fields:
            rejection_reasons.append("Missing required evidence keys.")
            rejection_reasons.extend(schema_errors)
        elif criteria_checklist_required and not criteria_checklist_all_true:
            rejection_reasons.append("One or more acceptance criteria were marked false.")
        elif gate_failures:
            rejection_reasons.extend(gate_failures)
        elif model_claim != "MET":
            rejection_reasons.append("Model claim is not MET.")
        else:
            accepted = True

        if not accepted:
            max_retries = int(policies.get("max_retries_per_step") or 2)
            exhausted_action = str(policies.get("retry_exhausted_action") or "PAUSE_FOR_HUMAN")
            failure_count = previous_rejections + 1
            if max_retries > 0 and failure_count >= max_retries:
                next_action = exhausted_action
                if exhausted_action == "PAUSE_FOR_HUMAN":
                    await self.job_pause(job_id)
                elif exhausted_action == "FAIL_JOB":
                    await self.job_fail(job_id, f"Retry limit reached for {step_id}")

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

    # =========================================================================
    # UI State Methods
    # =========================================================================

    async def get_steps(self, job_id: str) -> list[dict[str, Any]]:
        """Get all steps for a job."""
        async with self._conn.execute(
            "SELECT * FROM steps WHERE job_id = ? ORDER BY order_index ASC;",
            (job_id,),
        ) as cursor:
            rows = await cursor.fetchall()

        steps: list[dict[str, Any]] = []
        for row in rows:
            step = dict(row)
            step["acceptance_criteria"] = json.loads(step.pop("acceptance_criteria_json") or "[]")
            step["required_evidence"] = json.loads(step.pop("required_evidence_json") or "[]")
            expected_outputs_json = step.pop("expected_outputs_json", None)     
            step["expected_outputs"] = json.loads(expected_outputs_json or "[]") if expected_outputs_json else []
            step["context_refs"] = json.loads(step.pop("context_refs_json") or "[]")
            gates_json = step.pop("gates_json", None)
            step["gates"] = json.loads(gates_json or "[]") if gates_json else []
            steps.append(step)
        return steps

    async def approve_step(self, job_id: str, step_id: str) -> dict[str, Any]:
        """Grant human approval for a step (for human_approval gates)."""
        # Verify job and step exist
        job = await self.get_job(job_id)
        if job["status"] not in {"EXECUTING", "PAUSED"}:
            raise ValueError(f"Job {job_id} is not in EXECUTING/PAUSED state (status={job['status']})")

        step = await self._get_step(job_id, step_id)
        if not step:
            raise ValueError(f"Step {step_id} not found in job {job_id}")

        # Set human_approved flag
        await self._conn.execute(
            "UPDATE steps SET human_approved = 1 WHERE job_id = ? AND step_id = ?;",
            (job_id, step_id),
        )
        await self._conn.commit()

        return {"ok": True, "job_id": job_id, "step_id": step_id, "human_approved": True}

    async def revoke_step_approval(self, job_id: str, step_id: str) -> dict[str, Any]:
        """Revoke human approval for a step."""
        # Verify job and step exist
        await self.get_job(job_id)
        step = await self._get_step(job_id, step_id)
        if not step:
            raise ValueError(f"Step {step_id} not found in job {job_id}")

        # Clear human_approved flag
        await self._conn.execute(
            "UPDATE steps SET human_approved = 0 WHERE job_id = ? AND step_id = ?;",
            (job_id, step_id),
        )
        await self._conn.commit()

        return {"ok": True, "job_id": job_id, "step_id": step_id, "human_approved": False}

    async def get_attempts(self, job_id: str, step_id: str | None = None, limit: int = 20) -> list[dict[str, Any]]:
        """Get attempts for a job, optionally filtered by step."""
        if step_id:
            async with self._conn.execute(
                """
                SELECT * FROM attempts
                WHERE job_id = ? AND step_id = ?
                ORDER BY timestamp DESC
                LIMIT ?;
                """,
                (job_id, step_id, limit),
            ) as cursor:
                rows = await cursor.fetchall()
        else:
            async with self._conn.execute(
                """
                SELECT * FROM attempts
                WHERE job_id = ?
                ORDER BY timestamp DESC
                LIMIT ?;
                """,
                (job_id, limit),
            ) as cursor:
                rows = await cursor.fetchall()

        attempts: list[dict[str, Any]] = []
        for row in rows:
            attempt = dict(row)
            attempt["evidence"] = json.loads(attempt.pop("evidence_json") or "{}")
            attempt["rejection_reasons"] = json.loads(attempt.pop("rejection_reasons_json") or "[]")
            attempt["missing_fields"] = json.loads(attempt.pop("missing_fields_json") or "[]")
            attempts.append(attempt)
        return attempts

    async def get_ui_state(self, job_id: str) -> dict[str, Any]:
        """
        Get complete UI state for a job.

        This is the primary endpoint for the GUI, bundling all relevant
        state into a single response optimized for rendering.
        """
        from vibedev_mcp.conductor import get_phase_summary  

        job = await self.get_job(job_id)
        steps = await self.get_steps(job_id)
        mistakes = await self.mistake_list(job_id=job_id, limit=10)
        recent_logs = await self.devlog_list(job_id=job_id, limit=20)

        # Get phase info
        phase_summary = get_phase_summary(job)

        # Attempt counts per step (for UI badges/progress)
        async with self._conn.execute(
            """
            SELECT step_id, COUNT(1) AS n
            FROM attempts
            WHERE job_id = ?
            GROUP BY step_id;
            """,
            (job_id,),
        ) as cursor:
            rows = await cursor.fetchall()
        attempt_counts = {r["step_id"]: int(r["n"]) for r in rows}

        # Get current step details if executing
        current_step = None
        current_step_attempts: list[dict[str, Any]] = []
        if job["status"] in {"EXECUTING", "PAUSED"} and job.get("step_order"):
            idx = job.get("current_step_index", 0)
            if idx < len(job["step_order"]):
                current_step_id = job["step_order"][idx]
                for s in steps:
                    if s["step_id"] == current_step_id:
                        current_step = s
                        break
                current_step_attempts = await self.get_attempts(job_id, current_step_id, limit=5)

        # Get repo map if available
        repo_map = await self.repo_map_export(job_id=job_id, format="json")

        # Get git status if repo exists
        git_state = None
        if job.get("repo_root"):
            try:
                git_state = await self.git_status(job_id=job_id)
            except Exception:
                git_state = {"ok": False, "error": "Could not get git status"}

        # Compute step statuses
        step_statuses = []
        current_idx = job.get("current_step_index", 0)
        for i, step in enumerate(steps):
            if job["status"] == "COMPLETE":
                status = "DONE"
            elif job["status"] not in {"EXECUTING", "PAUSED"}:
                status = "PENDING"
            elif i < current_idx:
                status = "DONE"
            elif i == current_idx:
                status = "ACTIVE"
            else:
                status = "PENDING"
            step_statuses.append({
                **step,
                "status": status,
                "attempt_count": attempt_counts.get(step["step_id"], 0),
            })

        if job["status"] in {"EXECUTING", "PAUSED"} and job.get("step_order"):
            idx = int(job.get("current_step_index") or 0)
            if 0 <= idx < len(job["step_order"]):
                current_step_id = job["step_order"][idx]
                for s in step_statuses:
                    if s["step_id"] == current_step_id:
                        current_step = s
                        break

        # Context health indicators
        context_blocks = await self.context_search(job_id=job_id, query="", limit=100)

        return {
            "job": {
                "job_id": job["job_id"],
                "title": job["title"],
                "goal": job["goal"],
                "status": job["status"],
                "created_at": job["created_at"],
                "updated_at": job["updated_at"],
                "repo_root": job.get("repo_root"),
                "policies": job.get("policies", {}),
                "deliverables": job.get("deliverables", []),
                "invariants": job.get("invariants") or [],
                "definition_of_done": job.get("definition_of_done", []),        
                "current_step_index": job.get("current_step_index", 0),
                "total_steps": len(steps),
                "failure_reason": job.get("failure_reason"),
            },
            "phase": phase_summary,
            "steps": step_statuses,
            "current_step": current_step,
            "current_step_attempts": current_step_attempts,
            "mistakes": mistakes,
            "recent_logs": recent_logs,
            "repo_map": repo_map.get("entries", []),
            "git_status": git_state,
            "context_block_count": len(context_blocks),
            "planning_answers": job.get("planning_answers", {}),
        }

    # =========================================================================
    # Job Lifecycle Methods
    # =========================================================================

    async def job_pause(self, job_id: str) -> dict[str, Any]:
        """Pause an executing job."""
        job = await self.get_job(job_id)
        if job["status"] != "EXECUTING":
            raise ValueError(f"Job {job_id} is not EXECUTING (status={job['status']})")

        await self._conn.execute(
            "UPDATE jobs SET status = 'PAUSED', updated_at = ? WHERE job_id = ?;",
            (_utc_now_iso(), job_id),
        )
        await self._conn.commit()
        return {"ok": True, "job_id": job_id, "status": "PAUSED"}

    async def job_resume(self, job_id: str) -> dict[str, Any]:
        """Resume a paused job."""
        job = await self.get_job(job_id)
        if job["status"] != "PAUSED":
            raise ValueError(f"Job {job_id} is not PAUSED (status={job['status']})")

        await self._conn.execute(
            "UPDATE jobs SET status = 'EXECUTING', updated_at = ? WHERE job_id = ?;",
            (_utc_now_iso(), job_id),
        )
        await self._conn.commit()
        return {"ok": True, "job_id": job_id, "status": "EXECUTING"}

    async def job_fail(self, job_id: str, reason: str) -> dict[str, Any]:
        """Mark a job as failed with a reason."""
        job = await self.get_job(job_id)
        if job["status"] in {"COMPLETE", "ARCHIVED", "FAILED"}:
            raise ValueError(f"Job {job_id} cannot be failed (status={job['status']})")

        await self._conn.execute(
            "UPDATE jobs SET status = 'FAILED', failure_reason = ?, updated_at = ? WHERE job_id = ?;",
            (reason, _utc_now_iso(), job_id),
        )
        await self._conn.commit()

        # Record the failure as a mistake entry
        await self.mistake_record(
            job_id=job_id,
            title="Job Failed",
            what_happened=reason,
            why="Job marked as failed",
            lesson="Review failure reason before retrying",
            avoid_next_time="Address root cause",
            tags=["job_failure"],
            related_step_id=None,
        )

        return {"ok": True, "job_id": job_id, "status": "FAILED", "reason": reason}

    async def job_list(
        self,
        *,
        status: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> dict[str, Any]:
        """List jobs with optional status filter."""
        if status:
            async with self._conn.execute(
                """
                SELECT job_id, title, goal, status, created_at, updated_at,
                       step_order_json, current_step_index
                FROM jobs
                WHERE status = ?
                ORDER BY updated_at DESC
                LIMIT ? OFFSET ?;
                """,
                (status, limit, offset),
            ) as cursor:
                rows = await cursor.fetchall()
        else:
            async with self._conn.execute(
                """
                SELECT job_id, title, goal, status, created_at, updated_at,
                       step_order_json, current_step_index
                FROM jobs
                ORDER BY updated_at DESC
                LIMIT ? OFFSET ?;
                """,
                (limit, offset),
            ) as cursor:
                rows = await cursor.fetchall()

        items: list[dict[str, Any]] = []
        for row in rows:
            step_order = json.loads(row["step_order_json"] or "[]")
            items.append({
                "job_id": row["job_id"],
                "title": row["title"],
                "goal": row["goal"],
                "status": row["status"],
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
                "step_count": len(step_order),
                "current_step_index": row["current_step_index"] or 0,
            })

        return {"count": len(items), "items": items}

    # =========================================================================
    # Plan Refinement
    # =========================================================================

    async def plan_refine_steps(
        self,
        job_id: str,
        edits: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """
        Apply edits to existing steps without full replacement.

        Each edit is a dict with:
        - step_id: which step to edit
        - action: "update", "insert_before", "insert_after", "delete"
        - data: step data for update/insert actions
        """
        job = await self.get_job(job_id)
        if job["status"] not in {"PLANNING", "READY"}:
            raise ValueError(f"Job {job_id} cannot be refined (status={job['status']})")

        # Fetch current steps
        async with self._conn.execute(
            "SELECT * FROM steps WHERE job_id = ? ORDER BY order_index ASC;",
            (job_id,),
        ) as cursor:
            rows = await cursor.fetchall()

        steps: list[dict[str, Any]] = []
        for row in rows:
            step = dict(row)
            step["acceptance_criteria"] = json.loads(step.pop("acceptance_criteria_json") or "[]")
            step["required_evidence"] = json.loads(step.pop("required_evidence_json") or "[]")
            expected_outputs_json = step.pop("expected_outputs_json", None)
            step["expected_outputs"] = json.loads(expected_outputs_json or "[]") if expected_outputs_json else []
            step["context_refs"] = json.loads(step.pop("context_refs_json") or "[]")
            steps.append(step)

        step_map = {s["step_id"]: i for i, s in enumerate(steps)}

        for edit in edits:
            action = edit.get("action", "update")
            step_id = edit.get("step_id")
            data = edit.get("data", {})

            if action == "update":
                if step_id not in step_map:
                    raise KeyError(f"Unknown step_id: {step_id}")
                idx = step_map[step_id]
                for key, value in data.items():
                    if key in steps[idx]:
                        steps[idx][key] = value
            elif action == "delete":
                if step_id not in step_map:
                    raise KeyError(f"Unknown step_id: {step_id}")
                idx = step_map[step_id]
                steps.pop(idx)
                step_map = {s["step_id"]: i for i, s in enumerate(steps)}
            elif action == "insert_after":
                if step_id not in step_map:
                    raise KeyError(f"Unknown step_id: {step_id}")
                idx = step_map[step_id]
                new_step = self._normalize_step_data(data, len(steps) + 1)
                steps.insert(idx + 1, new_step)
                step_map = {s["step_id"]: i for i, s in enumerate(steps)}
            elif action == "insert_before":
                if step_id not in step_map:
                    raise KeyError(f"Unknown step_id: {step_id}")
                idx = step_map[step_id]
                new_step = self._normalize_step_data(data, len(steps) + 1)
                steps.insert(idx, new_step)
                step_map = {s["step_id"]: i for i, s in enumerate(steps)}

        # Re-save all steps
        normalized = await self.plan_propose_steps(
            job_id,
            [
                {
                    "step_id": s.get("step_id"),
                    "title": s["title"],
                    "instruction_prompt": s["instruction_prompt"],
                    "acceptance_criteria": s.get("acceptance_criteria", []),
                    "required_evidence": s.get("required_evidence", []),
                    "expected_outputs": s.get("expected_outputs", []),    
                    "remediation_prompt": s.get("remediation_prompt", ""),
                    "context_refs": s.get("context_refs", []),
                    "gates": s.get("gates", []),
                }
                for s in steps
            ],
        )
        return normalized

    def _normalize_step_data(self, data: dict[str, Any], default_index: int) -> dict[str, Any]:
        """Normalize step data with defaults."""
        return {
            "step_id": data.get("step_id") or f"S{default_index}",        
            "title": data.get("title", "Untitled Step"),
            "instruction_prompt": data.get("instruction_prompt", ""),     
            "acceptance_criteria": data.get("acceptance_criteria", []),   
            "required_evidence": data.get("required_evidence", []),       
            "expected_outputs": data.get("expected_outputs", []),
            "remediation_prompt": data.get("remediation_prompt", ""),     
            "context_refs": data.get("context_refs", []),
            "gates": data.get("gates", []),
        }

    # =========================================================================
    # Devlog Operations
    # =========================================================================

    async def devlog_list(
        self,
        *,
        job_id: str,
        log_type: str | None = None,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """List devlog entries for a job."""
        if log_type:
            async with self._conn.execute(
                """
                SELECT log_id, log_type, content, created_at, step_id, commit_hash
                FROM logs
                WHERE job_id = ? AND log_type = ?
                ORDER BY created_at DESC
                LIMIT ?;
                """,
                (job_id, log_type, limit),
            ) as cursor:
                rows = await cursor.fetchall()
        else:
            async with self._conn.execute(
                """
                SELECT log_id, log_type, content, created_at, step_id, commit_hash
                FROM logs
                WHERE job_id = ?
                ORDER BY created_at DESC
                LIMIT ?;
                """,
                (job_id, limit),
            ) as cursor:
                rows = await cursor.fetchall()

        return [dict(row) for row in rows]

    async def devlog_export(
        self,
        *,
        job_id: str,
        format: str = "md",
    ) -> dict[str, Any]:
        """Export devlog entries for a job."""
        logs = await self.devlog_list(job_id=job_id, limit=1000)
        logs.reverse()  # Chronological order

        if format == "json":
            return {"format": "json", "entries": logs}

        job = await self.get_job(job_id)
        lines = [
            f"# Dev Log: {job.get('title', '(untitled)')} ({job_id})",
            "",
        ]
        for log in logs:
            step_info = f" [{log['step_id']}]" if log.get("step_id") else ""
            commit_info = f" ({log['commit_hash'][:8]})" if log.get("commit_hash") else ""
            lines.append(f"- **{log['created_at']}**{step_info}{commit_info}: {log['content']}")

        return {"format": "md", "content": "\n".join(lines)}

    # =========================================================================
    # Git Integration
    # =========================================================================

    async def git_status(self, *, job_id: str) -> dict[str, Any]:
        """Get git status for a job's repo."""
        job = await self.get_job(job_id)
        repo_root = job.get("repo_root")
        if not repo_root:
            raise ValueError(f"Job {job_id} has no repo_root set")        

        try:
            result = subprocess.run(
                ["git", "status", "--porcelain"],
                cwd=repo_root,
                capture_output=True,
                text=True,
                timeout=30,
            )
            if result.returncode != 0:
                return {"ok": False, "error": result.stderr}

            lines = result.stdout.splitlines() if result.stdout else []
            modified: list[str] = []
            added: list[str] = []
            deleted: list[str] = []

            for line in lines:
                if not line or len(line) < 4:
                    continue
                status = line[:2]
                path = line[3:]
                if " -> " in path:
                    _, path = path.split(" -> ", 1)
                if status == "??":
                    added.append(path)
                elif "D" in status:
                    deleted.append(path)
                elif "A" in status:
                    added.append(path)
                else:
                    modified.append(path)

            return {
                "ok": True,
                "clean": len(lines) == 0,
                "modified": modified,
                "added": added,
                "deleted": deleted,
                "raw": result.stdout,
            }
        except subprocess.TimeoutExpired:
            return {"ok": False, "error": "git status timed out"}
        except FileNotFoundError:
            return {"ok": False, "error": "git not found"}

    async def git_diff_summary(self, *, job_id: str, staged: bool = False) -> dict[str, Any]:
        """Get git diff summary for a job's repo."""
        job = await self.get_job(job_id)
        repo_root = job.get("repo_root")
        if not repo_root:
            raise ValueError(f"Job {job_id} has no repo_root set")

        try:
            cmd = ["git", "diff", "--stat"]
            if staged:
                cmd.append("--staged")

            result = subprocess.run(
                cmd,
                cwd=repo_root,
                capture_output=True,
                text=True,
                timeout=30,
            )
            if result.returncode != 0:
                return {"ok": False, "error": result.stderr}

            return {
                "ok": True,
                "staged": staged,
                "summary": result.stdout,
            }
        except subprocess.TimeoutExpired:
            return {"ok": False, "error": "git diff timed out"}
        except FileNotFoundError:
            return {"ok": False, "error": "git not found"}

    async def git_log(
        self,
        *,
        job_id: str,
        n: int = 10,
    ) -> dict[str, Any]:
        """Get recent git commits for a job's repo."""
        job = await self.get_job(job_id)
        repo_root = job.get("repo_root")
        if not repo_root:
            raise ValueError(f"Job {job_id} has no repo_root set")

        try:
            result = subprocess.run(
                ["git", "log", f"-{n}", "--oneline"],
                cwd=repo_root,
                capture_output=True,
                text=True,
                timeout=30,
            )
            if result.returncode != 0:
                return {"ok": False, "error": result.stderr}

            commits = []
            for line in result.stdout.strip().split("\n"):
                if line:
                    parts = line.split(" ", 1)
                    commits.append({
                        "hash": parts[0],
                        "message": parts[1] if len(parts) > 1 else "",
                    })

            return {"ok": True, "commits": commits}
        except subprocess.TimeoutExpired:
            return {"ok": False, "error": "git log timed out"}
        except FileNotFoundError:
            return {"ok": False, "error": "git not found"}

    # =========================================================================
    # Repo Hygiene
    # =========================================================================

    async def repo_hygiene_suggest(
        self,
        *,
        job_id: str,
        max_suggestions: int = 20,
    ) -> dict[str, Any]:
        """
        Suggest repo hygiene improvements.

        Returns suggestions for:
        - Stale/backup files
        - Files without descriptions in repo map
        - Large files
        - Files not in any import graph (if detectable)
        """
        job = await self.get_job(job_id)
        repo_root = job.get("repo_root")
        if not repo_root:
            raise ValueError(f"Job {job_id} has no repo_root set")

        suggestions: list[dict[str, str]] = []

        # Get stale candidates
        stale = find_stale_candidates(repo_root, max_results=max_suggestions // 2)
        for item in stale:
            suggestions.append({
                "type": "stale_file",
                "path": item["path"],
                "suggestion": f"Consider removing: {item['reason']}",
            })

        # Get files without descriptions
        async with self._conn.execute(
            "SELECT path FROM repo_map_entries WHERE job_id = ?;",
            (job_id,),
        ) as cursor:
            rows = await cursor.fetchall()
        described_paths = {row["path"] for row in rows}

        # Find undescribed files from latest snapshot
        async with self._conn.execute(
            "SELECT key_files_json FROM repo_snapshots WHERE job_id = ? ORDER BY timestamp DESC LIMIT 1;",
            (job_id,),
        ) as cursor:
            row = await cursor.fetchone()

        if row:
            key_files = json.loads(row["key_files_json"] or "[]")
            undescribed = [f for f in key_files if f not in described_paths][:max_suggestions // 2]
            for path in undescribed:
                suggestions.append({
                    "type": "undescribed_file",
                    "path": path,
                    "suggestion": "Add description to repo map",
                })

        return {
            "count": len(suggestions),
            "suggestions": suggestions[:max_suggestions],
        }
