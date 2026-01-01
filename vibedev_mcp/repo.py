from __future__ import annotations

import os
import re
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


def analyze_dependencies(
    repo_root: str | Path,
    *,
    ignore_dirs: set[str] | None = None,
) -> dict[str, list[str]]:
    """
    Analyze file dependencies using regex heuristics.
    Returns adjacency list: { "path/to/file": ["import1", "import2"] }
    """
    root = Path(repo_root).resolve()
    ignores = DEFAULT_IGNORE_DIRS if ignore_dirs is None else ignore_dirs
    dependencies: dict[str, list[str]] = {}

    # Regex patterns
    # Python: from x import y, import x
    re_py_import = re.compile(r"^\s*(?:from|import)\s+([\w\.]+)")
    
    # JS/TS: import ... from 'x', require('x')
    re_js_import = re.compile(r"(?:import\s+.*?from\s+['\"]|require\(['\"])([^'\"]+)['\"]")

    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in ignores]
        
        for fname in filenames:
            ext = os.path.splitext(fname)[1].lower()
            if ext not in {".py", ".js", ".ts", ".tsx", ".jsx"}:
                continue
            
            fpath = (Path(dirpath) / fname)
            rel_path = str(fpath.resolve().relative_to(root)).replace("\\", "/")
            
            deps = set()
            try:
                content = fpath.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue

            if ext == ".py":
                for line in content.splitlines():
                    m = re_py_import.match(line)
                    if m:
                        deps.add(m.group(1))
            else:
                # JS/TS - simpler to scan whole content for matches
                # (naive but effective for "RepoMap")
                for m in re_js_import.finditer(content):
                    deps.add(m.group(1))
            
            if deps:
                dependencies[rel_path] = sorted(list(deps))

    return dependencies
