import argparse
import json
import sys
import urllib.error
import urllib.request


def http_json(method: str, url: str, body: dict | None = None) -> dict:
    data = None
    headers = {"Content-Type": "application/json"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, method=method, data=data, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {e.code} {e.reason}: {raw}") from e


def pick_job_id(server: str) -> str | None:
    # Prefer EXECUTING; fall back to PAUSED; then READY.
    for status in ("EXECUTING", "PAUSED", "READY"):
        data = http_json("GET", f"{server}/api/jobs?status={status}")
        items = data.get("items") or []
        if items:
            return items[0].get("job_id")
    return None


def main() -> int:
    ap = argparse.ArgumentParser(description="Fetch next VibeDev step prompt (vd next).")
    ap.add_argument("--server", default="http://127.0.0.1:8765", help="VibeDev server base URL")
    ap.add_argument("--job-id", default=None, help="Job ID (JOB_...)")
    ap.add_argument("--json", action="store_true", help="Print raw JSON response")
    args = ap.parse_args()

    server = args.server.rstrip("/")
    job_id = args.job_id or pick_job_id(server)
    if not job_id:
        print("No job found (expected at least one EXECUTING/PAUSED/READY job).", file=sys.stderr)
        return 2

    # If READY, start automatically (common "vd next" expectation).
    try:
        status = http_json("GET", f"{server}/api/jobs/{job_id}/status")
        if status.get("status") == "READY":
            http_json("POST", f"{server}/api/jobs/{job_id}/start", body={})
    except Exception:
        # If status endpoint fails, continue and let next-prompt-auto report errors.
        pass

    data = http_json("GET", f"{server}/api/jobs/{job_id}/next-prompt-auto")
    if args.json:
        print(json.dumps(data, indent=2))
        return 0

    action = data.get("action")
    reason = data.get("reason")
    step_id = data.get("step_id")

    header = f"[vd-next] job_id={job_id}"
    if step_id:
        header += f" step_id={step_id}"
    if action:
        header += f" action={action}"
    print(header)
    if reason:
        print(f"Reason: {reason}")
    print("")

    if action in ("NEXT_STEP", "RETRY", "NEW_THREAD"):
        prompt = data.get("prompt") or ""
        if not prompt.strip():
            print("No prompt returned.", file=sys.stderr)
            return 3
        print(prompt)
        return 0

    if action == "AWAIT_HUMAN":
        print("Awaiting human action. Resolve the reason above (e.g. approve step / resume job), then run vd-next again.")
        return 0

    if action == "DIAGNOSE":
        print("Diagnose mode reached (retry limit exceeded). Fix plan/policies or add a diagnose step, then run vd-next again.")
        return 0

    if action == "JOB_COMPLETE":
        print("Job complete.")
        return 0

    print(f"Unhandled action: {action!r}")
    print(json.dumps(data, indent=2))
    return 4


if __name__ == "__main__":
    raise SystemExit(main())
