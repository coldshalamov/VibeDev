import argparse
import asyncio
import json
import os
import sys
from pathlib import Path
from typing import Any

from vibedev_mcp.store import VibeDevStore


def _default_db_path() -> Path:
    return Path.home() / ".vibedev" / "vibedev.sqlite3"


def _load_json_file(path: str) -> dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        raw = f.read()
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise ValueError("Evidence JSON must be an object.")
    return data


def _load_json_stdin() -> dict[str, Any]:
    raw = sys.stdin.read()
    if not raw.strip():
        raise ValueError("No stdin provided.")
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise ValueError("Evidence JSON must be an object.")
    return data


async def _run_runner(*, job_id: str, evidence_path: str | None, model_claim: str, summary: str | None) -> int:
    db_path = Path(os.environ.get("VIBEDEV_DB_PATH", str(_default_db_path())))
    store = await VibeDevStore.open(db_path)
    try:
        try:
            await store.job_start(job_id)
        except Exception as e:
            print(f"Error: cannot start job {job_id}: {e}", file=sys.stderr)
            return 2

        while True:
            prompt = await store.job_next_step_prompt(job_id)
            step_id = str(prompt["step_id"])

            print(f"\n=== Step {step_id} ===")
            print(prompt["prompt"])
            print("\n--- Injection Preview ---")
            preview = {
                "invariants": prompt.get("invariants", []),
                "relevant_mistakes": prompt.get("relevant_mistakes", []),
                "required_evidence": prompt.get("required_evidence", {}),
                "required_evidence_template": prompt.get("required_evidence_template", {}),
            }
            print(json.dumps(preview, indent=2))

            try:
                if evidence_path:
                    evidence = _load_json_file(evidence_path)
                else:
                    if sys.stdin.isatty():
                        print(
                            "\nPaste evidence JSON and end input with EOF (Ctrl+Z then Enter on Windows):",
                            file=sys.stderr,
                        )
                    evidence = _load_json_stdin()
            except Exception as e:
                print(f"Error: invalid evidence JSON: {e}", file=sys.stderr)
                return 2

            effective_summary = summary
            if not effective_summary:
                effective_summary = str(evidence.get("diff_summary") or "submitted via vibedev runner")

            result = await store.job_submit_step_result(
                job_id=job_id,
                step_id=step_id,
                model_claim=model_claim,
                summary=effective_summary,
                evidence=evidence,
                devlog_line=None,
                commit_hash=None,
            )

            accepted = bool(result.get("accepted"))
            next_action = str(result.get("next_action") or "")

            print("\n--- Gate Result ---")
            print(f"accepted: {accepted}")
            print(f"next_action: {next_action}")
            if result.get("missing_fields"):
                print("missing_fields:")
                for k in result["missing_fields"]:
                    print(f"- {k}")
            if result.get("rejection_reasons"):
                print("rejection_reasons:")
                for r in result["rejection_reasons"]:
                    print(f"- {r}")

            if accepted and next_action == "NEXT_STEP_AVAILABLE":
                if evidence_path and sys.stdin.isatty():
                    input(f"\nNext step available. Update {evidence_path} and press Enter to continue...")
                continue
            if accepted and next_action == "JOB_COMPLETE":
                return 0
            if next_action == "RETRY":
                if evidence_path and sys.stdin.isatty():
                    input(f"\nStep rejected. Update {evidence_path} and press Enter to retry...")
                    continue
                if evidence_path:
                    print("\nStep rejected (non-interactive); rerun with updated --evidence to retry.", file=sys.stderr)
                    return 1
                continue
            if next_action == "PAUSE_FOR_HUMAN":
                return 2
            if next_action == "FAIL_JOB":
                return 3

            return 1
    finally:
        await store.close()


async def _status_job(*, job_id: str) -> int:
    """Show the current status of a job."""
    db_path = Path(os.environ.get("VIBEDEV_DB_PATH", str(_default_db_path())))
    store = await VibeDevStore.open(db_path)
    try:
        try:
            job = await store.job_get(job_id)
        except Exception as e:
            print(f"Error: {e}", file=sys.stderr)
            return 1

        steps = await store.job_list_steps(job_id)

        # Header
        print(f"\n{'='*60}")
        print(f"Job: {job['title']}")
        print(f"ID:  {job_id}")
        print(f"{'='*60}")

        # Status
        status = job.get("status", "UNKNOWN")
        status_colors = {
            "PLANNING": "🟡",
            "READY": "🟢",
            "EXECUTING": "🔵",
            "PAUSED": "🟠",
            "COMPLETED": "✅",
            "FAILED": "❌",
        }
        print(f"\nStatus: {status_colors.get(status, '⚪')} {status}")

        # Phase info (if planning)
        if status == "PLANNING":
            phase = job.get("planning_answers", {})
            print(f"Planning answers collected: {len(phase)}")

        # Step progress
        done = sum(1 for s in steps if s.get("status") == "DONE")
        failed = sum(1 for s in steps if s.get("status") == "FAILED")
        active = sum(1 for s in steps if s.get("status") == "ACTIVE")
        pending = sum(1 for s in steps if s.get("status") == "PENDING")

        print(f"\nSteps: {len(steps)} total")
        print(f"  ✅ Done:    {done}")
        print(f"  🔵 Active:  {active}")
        print(f"  ⏳ Pending: {pending}")
        print(f"  ❌ Failed:  {failed}")

        # Current step details
        active_steps = [s for s in steps if s.get("status") == "ACTIVE"]
        if active_steps:
            current = active_steps[0]
            print(f"\n--- Current Step ---")
            print(f"Title: {current.get('title', 'Untitled')}")
            print(f"Attempts: {current.get('attempt_count', 0)}")

        # Mistakes
        mistakes = await store.mistake_list(job_id)
        if mistakes:
            print(f"\n⚠️  Recorded Mistakes: {len(mistakes)}")
            for m in mistakes[:3]:  # Show first 3
                print(f"  - {m.get('description', 'No description')[:60]}...")

        print()
        return 0
    finally:
        await store.close()


async def _list_jobs(*, status_filter: str | None, limit: int) -> int:
    """List all jobs, optionally filtered by status."""
    db_path = Path(os.environ.get("VIBEDEV_DB_PATH", str(_default_db_path())))
    store = await VibeDevStore.open(db_path)
    try:
        jobs = await store.job_list(status=status_filter, limit=limit)

        if not jobs:
            print("No jobs found.")
            return 0

        print(f"\n{'ID':<36} {'Status':<12} {'Title'}")
        print("-" * 80)
        for job in jobs:
            status = job.get("status", "UNKNOWN")
            title = job.get("title", "Untitled")[:40]
            job_id = job.get("job_id", "???")
            print(f"{job_id:<36} {status:<12} {title}")
        print()
        return 0
    finally:
        await store.close()


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="vibedev")
    sub = parser.add_subparsers(dest="command", required=True)

    # Runner command
    runner = sub.add_parser("runner", help="Run an evidence-gated job loop")
    runner.add_argument("--job", required=True, help="Job ID to execute")
    runner.add_argument(
        "--evidence",
        help="Path to evidence JSON (if omitted, read from stdin until EOF)",
    )
    runner.add_argument("--model-claim", default="MET", choices=["MET", "NOT_MET", "PARTIAL"])
    runner.add_argument("--summary", help="Attempt summary (defaults from evidence.diff_summary)")

    # Status command
    status_cmd = sub.add_parser("status", help="Show current status of a job")
    status_cmd.add_argument("job_id", help="Job ID to check")

    # List command
    list_cmd = sub.add_parser("list", help="List all jobs")
    list_cmd.add_argument("--status", choices=["PLANNING", "READY", "EXECUTING", "PAUSED", "COMPLETED", "FAILED"],
                          help="Filter by status")
    list_cmd.add_argument("--limit", type=int, default=20, help="Max jobs to show (default: 20)")

    args = parser.parse_args(argv)

    if args.command == "runner":
        code = asyncio.run(
            _run_runner(
                job_id=str(args.job),
                evidence_path=str(args.evidence) if args.evidence else None,
                model_claim=str(args.model_claim),
                summary=str(args.summary) if args.summary else None,
            )
        )
        raise SystemExit(code)

    if args.command == "status":
        code = asyncio.run(_status_job(job_id=str(args.job_id)))
        raise SystemExit(code)

    if args.command == "list":
        code = asyncio.run(_list_jobs(status_filter=args.status, limit=args.limit))
        raise SystemExit(code)

    raise SystemExit(2)


if __name__ == "__main__":
    main()

