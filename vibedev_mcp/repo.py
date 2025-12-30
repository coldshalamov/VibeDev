from __future__ import annotations

import os
from pathlib import Path


DEFAULT_IGNORE_DIRS = {
    ".git",
    ".hg",
    ".svn",
    ".venv",
    "venv",
    "__pycache__",
    ".pytest_cache",
    "node_modules",
    ".vibedev",
}


def snapshot_file_tree(
    repo_root: str | Path,
    *,
    max_depth: int = 5,
    max_entries: int = 2000,
    ignore_dirs: set[str] | None = None,
) -> tuple[str, list[str]]:
    root = Path(repo_root).resolve()
    ignores = DEFAULT_IGNORE_DIRS if ignore_dirs is None else ignore_dirs

    lines: list[str] = []
    key_files: list[str] = []
    entries = 0

    for dirpath, dirnames, filenames in os.walk(root):
        rel_dir = Path(dirpath).resolve().relative_to(root)
        depth = 0 if str(rel_dir) == "." else len(rel_dir.parts)
        if depth > max_depth:
            dirnames[:] = []
            continue

        # Filter ignored directories in-place so os.walk doesn't traverse them.
        dirnames[:] = [d for d in dirnames if d not in ignores]

        indent = "  " * depth
        if depth == 0:
            lines.append(".")
        else:
            lines.append(f"{indent}{rel_dir.name}/")
        entries += 1
        if entries >= max_entries:
            lines.append(f"{indent}... (truncated)")
            break

        for fname in sorted(filenames)[:200]:
            rel_file = (Path(dirpath) / fname).resolve().relative_to(root)
            lines.append(f"{indent}  {fname}")
            entries += 1
            if entries >= max_entries:
                lines.append(f"{indent}  ... (truncated)")
                break

            lower = fname.lower()
            if lower in {"readme.md", "pyproject.toml", "package.json"} or lower.endswith(
                (".md", ".py", ".ts", ".tsx", ".js", ".json", ".yaml", ".yml")
            ):
                if len(key_files) < 50:
                    key_files.append(str(rel_file).replace("\\", "/"))

        if entries >= max_entries:
            break

    return "\n".join(lines), key_files


def find_stale_candidates(
    repo_root: str | Path,
    *,
    max_results: int = 50,
    ignore_dirs: set[str] | None = None,
) -> list[dict[str, str]]:
    """
    Heuristic "stale/bloat" detection.

    This is intentionally conservative: it only flags obvious candidates by filename patterns.
    """
    root = Path(repo_root).resolve()
    ignores = DEFAULT_IGNORE_DIRS if ignore_dirs is None else ignore_dirs

    patterns = [
        ("backup", "Filename suggests backup/copy artifact."),
        ("copy", "Filename suggests duplicated copy."),
        ("old", "Filename suggests legacy/old artifact."),
        ("deprecated", "Filename suggests deprecated artifact."),
        (".bak", "Backup extension."),
        (".tmp", "Temporary file extension."),
        ("~", "Editor backup suffix."),
    ]

    out: list[dict[str, str]] = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in ignores]
        for fname in filenames:
            lower = fname.lower()
            reason = None
            for needle, why in patterns:
                if needle in lower:
                    reason = why
                    break
            if reason is None:
                continue
            rel = (Path(dirpath) / fname).resolve().relative_to(root)
            out.append({"path": str(rel).replace("\\", "/"), "reason": reason})
            if len(out) >= max_results:
                return out
    return out
