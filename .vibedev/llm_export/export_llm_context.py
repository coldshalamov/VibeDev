from __future__ import annotations

import argparse
import fnmatch
import hashlib
import os
import shutil
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Iterator


@dataclass(frozen=True)
class ExportConfig:
    repo_root: Path
    out_dir: Path
    max_bytes: int
    copy_repo: bool
    zip_repo: bool


DEFAULT_INCLUDE_DIRS = (
    "docs",
    "configs",
    "vibedev_mcp",
    "vibedev-ui",
    "vibedev-vscode",
)

DEFAULT_INCLUDE_ROOT_FILES = (
    "README.md",
    "AGENTS.md",
    "CLAUDE.md",
    "pyproject.toml",
    "pytest.ini",
    ".gitignore",
    ".editorconfig",
    ".gitattributes",
    ".pre-commit-config.yaml",
    "COMPLETION_SUMMARY.md",
)

EXCLUDE_DIR_NAMES = {
    ".git",
    ".hg",
    ".svn",
    ".idea",
    ".vscode",
    ".pytest_cache",
    "__pycache__",
    ".mypy_cache",
    ".ruff_cache",
    ".tox",
    ".venv",
    "venv",
    "node_modules",
    "dist",
    "build",
    "coverage",
    ".next",
    ".vite",
    "PAPERS_EXTRACTED",
    "tests",
    "vibedev_mcp.egg-info",
}

# Always skip these globs (relative paths, POSIX-style).
EXCLUDE_GLOBS = (
    "**/.env",
    "**/.env.*",
    "**/*.pem",
    "**/*.key",
    "**/id_rsa",
    "**/id_rsa.*",
    "**/*.sqlite3",
    "**/*.db",
    "**/*.zip",
    "**/*.vsix",
)

BINARY_EXTS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".ico",
    ".webp",
    ".pdf",
    ".zip",
    ".7z",
    ".tar",
    ".gz",
    ".bz2",
    ".xz",
    ".mp3",
    ".wav",
    ".mp4",
    ".mov",
    ".webm",
    ".woff",
    ".woff2",
    ".ttf",
    ".otf",
    ".eot",
    ".exe",
    ".dll",
    ".pyd",
    ".so",
    ".dylib",
    ".bin",
}


def _find_repo_root(start: Path) -> Path:
    for candidate in [start, *start.parents]:
        if (candidate / "pyproject.toml").exists():
            return candidate
    return start


def _is_under_any(path: Path, roots: Iterable[Path]) -> bool:
    for r in roots:
        try:
            path.relative_to(r)
            return True
        except ValueError:
            continue
    return False


def _matches_any_glob(rel_posix: str, globs: Iterable[str]) -> bool:
    return any(fnmatch.fnmatch(rel_posix, g) for g in globs)


def _should_skip(rel_posix: str, path: Path) -> bool:
    parts = Path(rel_posix).parts
    if any(p in EXCLUDE_DIR_NAMES for p in parts):
        return True
    if _matches_any_glob(rel_posix, EXCLUDE_GLOBS):
        return True
    if path.suffix.lower() in BINARY_EXTS:
        return True
    return False


def _iter_files(cfg: ExportConfig) -> Iterator[Path]:
    include_roots = [cfg.repo_root / d for d in DEFAULT_INCLUDE_DIRS if (cfg.repo_root / d).exists()]
    include_root_files = [cfg.repo_root / f for f in DEFAULT_INCLUDE_ROOT_FILES if (cfg.repo_root / f).exists()]

    seen: set[Path] = set()

    for f in include_root_files:
        if f.is_file():
            seen.add(f)
            yield f

    for base in include_roots:
        for path in base.rglob("*"):
            if not path.is_file():
                continue
            rel = path.relative_to(cfg.repo_root).as_posix()
            if _should_skip(rel, path):
                continue
            if path in seen:
                continue
            seen.add(path)
            yield path


def _looks_binary(sample: bytes) -> bool:
    if b"\x00" in sample:
        return True
    # Heuristic: high proportion of non-text bytes
    text = sum(1 for b in sample if b in b"\t\r\n" or 32 <= b <= 126)
    return len(sample) > 0 and (text / len(sample)) < 0.7


def _read_text_best_effort(path: Path, max_bytes: int) -> tuple[str | None, str]:
    data = path.read_bytes()
    if len(data) > max_bytes:
        return None, f"skipped: file too large ({len(data)} bytes > {max_bytes} bytes)"

    head = data[:8192]
    if _looks_binary(head):
        return None, "skipped: looks binary"

    try:
        return data.decode("utf-8"), "ok"
    except UnicodeDecodeError:
        return data.decode("utf-8", errors="replace"), "ok (decoded with replacement)"


def _guess_lang(path: Path) -> str:
    ext = path.suffix.lower()
    return {
        ".py": "python",
        ".ts": "ts",
        ".tsx": "tsx",
        ".js": "js",
        ".jsx": "jsx",
        ".json": "json",
        ".md": "markdown",
        ".yml": "yaml",
        ".yaml": "yaml",
        ".toml": "toml",
        ".ini": "ini",
        ".css": "css",
        ".html": "html",
        ".sh": "bash",
        ".ps1": "powershell",
    }.get(ext, "")


def _fence_for(content: str) -> str:
    max_run = 0
    run = 0
    for ch in content:
        if ch == "`":
            run += 1
            max_run = max(max_run, run)
        else:
            run = 0
    return "`" * max(3, max_run + 1)


def _sha256_hex(data: bytes) -> str:
    h = hashlib.sha256()
    h.update(data)
    return h.hexdigest()


def _write_markdown(cfg: ExportConfig, files: list[Path]) -> tuple[Path, Path]:
    cfg.out_dir.mkdir(parents=True, exist_ok=True)
    md_path = cfg.out_dir / "LLM_CONTEXT.md"
    manifest_path = cfg.out_dir / "manifest.txt"

    included: list[str] = []
    skipped: list[str] = []

    # Build a stable, readable list
    rels = sorted([f.relative_to(cfg.repo_root).as_posix() for f in files])
    included.extend(rels)

    with md_path.open("w", encoding="utf-8", newline="\n") as md:
        md.write("# VibeDev — LLM Context Export\n\n")
        md.write("This file is an automatically generated, pruned view of the repo intended for LLM ingestion.\n\n")
        md.write("## Included Paths\n\n")
        for rel in rels:
            md.write(f"- `{rel}`\n")
        md.write("\n## File Contents\n\n")

        for f in sorted(files, key=lambda p: p.relative_to(cfg.repo_root).as_posix()):
            rel = f.relative_to(cfg.repo_root).as_posix()

            text, status = _read_text_best_effort(f, cfg.max_bytes)
            if text is None:
                skipped.append(f"{rel}\t{status}")
                md.write(f"### `{rel}`\n\n")
                md.write(f"_({status})_\n\n")
                continue

            lang = _guess_lang(f)
            fence = _fence_for(text)
            md.write(f"### `{rel}`\n\n")
            md.write(f"_({status}; {len(text.encode('utf-8'))} bytes)_\n\n")
            md.write(f"{fence}{lang}\n")
            md.write(text)
            if not text.endswith("\n"):
                md.write("\n")
            md.write(f"{fence}\n\n")

    with manifest_path.open("w", encoding="utf-8", newline="\n") as mf:
        mf.write("included_files:\n")
        for rel in rels:
            mf.write(f"  - {rel}\n")
        mf.write("\n")
        mf.write("skipped_files:\n")
        for item in skipped:
            mf.write(f"  - {item}\n")
        mf.write("\n")

    return md_path, manifest_path


def _copy_repo(cfg: ExportConfig, files: list[Path]) -> Path:
    pruned_root = cfg.out_dir / "pruned_repo"
    if pruned_root.exists():
        shutil.rmtree(pruned_root)
    pruned_root.mkdir(parents=True, exist_ok=True)

    for f in files:
        rel = f.relative_to(cfg.repo_root)
        dst = pruned_root / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(f, dst)

    return pruned_root


def _zip_dir(src_dir: Path, zip_path: Path) -> None:
    if zip_path.exists():
        zip_path.unlink()
    # shutil.make_archive wants the path without extension
    base_name = zip_path.with_suffix("")
    shutil.make_archive(str(base_name), "zip", root_dir=str(src_dir))


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Export a pruned repo view for LLM ingestion.")
    parser.add_argument(
        "--out",
        default=None,
        help="Output directory (default: <repo>/.vibedev/llm_export)",
    )
    parser.add_argument(
        "--max-bytes",
        type=int,
        default=300_000,
        help="Skip files larger than this many bytes (default: 300000)",
    )
    parser.add_argument(
        "--no-copy",
        action="store_true",
        help="Do not create a pruned_repo/ directory (markdown + manifest only)",
    )
    parser.add_argument(
        "--zip",
        action="store_true",
        help="Also create pruned_repo.zip",
    )

    args = parser.parse_args(argv)

    repo_root = _find_repo_root(Path.cwd())
    out_dir = Path(args.out) if args.out else repo_root / ".vibedev" / "llm_export"
    cfg = ExportConfig(
        repo_root=repo_root,
        out_dir=out_dir,
        max_bytes=args.max_bytes,
        copy_repo=not args.no_copy,
        zip_repo=bool(args.zip),
    )

    files = list(_iter_files(cfg))

    # Extra safeguard: never allow exporting outside repo.
    files = [f for f in files if _is_under_any(f, [cfg.repo_root])]

    md_path, manifest_path = _write_markdown(cfg, files)

    pruned_root = None
    zip_path = None
    if cfg.copy_repo:
        pruned_root = _copy_repo(cfg, files)
        if cfg.zip_repo:
            zip_path = cfg.out_dir / "pruned_repo.zip"
            _zip_dir(pruned_root, zip_path)

    print(f"Wrote: {md_path}")
    print(f"Wrote: {manifest_path}")
    if pruned_root is not None:
        print(f"Wrote: {pruned_root}")
    if zip_path is not None:
        print(f"Wrote: {zip_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

