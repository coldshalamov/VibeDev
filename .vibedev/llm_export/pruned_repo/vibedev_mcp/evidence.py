"""Evidence validation module for VibeDev.

This module provides strict validation for evidence submissions,
ensuring that claims are verifiable and not hand-wavy.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any


class EvidenceValidationResult:
    """Result of evidence validation."""

    def __init__(self) -> None:
        self.issues: list[str] = []
        self.warnings: list[str] = []

    @property
    def is_valid(self) -> bool:
        return len(self.issues) == 0

    def add_issue(self, message: str) -> None:
        self.issues.append(message)

    def add_warning(self, message: str) -> None:
        self.warnings.append(message)

    def to_dict(self) -> dict[str, Any]:
        return {
            "valid": self.is_valid,
            "issues": self.issues,
            "warnings": self.warnings,
        }


# Patterns that indicate hand-wavy / vague descriptions
VAGUE_PATTERNS = [
    r"^done\.?$",
    r"^fixed\.?$",
    r"^works\.?$",
    r"^updated\.?$",
    r"^changed\.?$",
    r"^completed\.?$",
    r"^implemented\.?$",
    r"^made changes\.?$",
    r"^see above\.?$",
    r"^as above\.?$",
    r"^same as before\.?$",
]

# Minimum lengths for text fields
MIN_DIFF_SUMMARY_LENGTH = 20
MIN_SUMMARY_LENGTH = 15


def validate_evidence(
    evidence: dict[str, Any],
    required_fields: list[str],
    repo_root: str | None = None,
    strict_mode: bool = False,
) -> EvidenceValidationResult:
    """
    Validate evidence against requirements.

    Args:
        evidence: The evidence dict submitted by the model
        required_fields: List of required field names
        repo_root: Optional repo root for file path validation
        strict_mode: If True, apply stricter validation rules

    Returns:
        EvidenceValidationResult with issues and warnings
    """
    result = EvidenceValidationResult()

    # Check required fields
    for field in required_fields:
        if field not in evidence:
            result.add_issue(f"Missing required field: {field}")
        elif evidence[field] is None:
            result.add_issue(f"Required field is null: {field}")
        elif isinstance(evidence[field], str) and not evidence[field].strip():
            result.add_issue(f"Required field is empty: {field}")
        elif isinstance(evidence[field], list) and len(evidence[field]) == 0:
            result.add_issue(f"Required field is empty list: {field}")

    # Validate changed_files
    if "changed_files" in evidence:
        changed_files = evidence["changed_files"]
        if not isinstance(changed_files, list):
            result.add_issue("changed_files must be a list")
        elif repo_root:
            repo_path = Path(repo_root)
            for file_path in changed_files:
                if not isinstance(file_path, str):
                    result.add_issue(f"changed_files entry is not a string: {file_path}")
                    continue
                full_path = repo_path / file_path
                if not full_path.exists():
                    if strict_mode:
                        result.add_issue(f"changed_files: '{file_path}' does not exist")
                    else:
                        result.add_warning(f"changed_files: '{file_path}' does not exist")

    # Validate diff_summary
    if "diff_summary" in evidence:
        diff_summary = evidence["diff_summary"]
        if isinstance(diff_summary, str):
            _validate_text_quality(diff_summary, "diff_summary", MIN_DIFF_SUMMARY_LENGTH, result, strict_mode)

    # Validate tests_passed is boolean
    if "tests_passed" in evidence:
        if not isinstance(evidence["tests_passed"], bool):
            result.add_issue("tests_passed must be a boolean")

    # Validate tests_run is a list
    if "tests_run" in evidence:
        tests_run = evidence["tests_run"]
        if not isinstance(tests_run, list):
            result.add_issue("tests_run must be a list")
        elif len(tests_run) == 0 and strict_mode:
            result.add_warning("tests_run is empty - did you actually run tests?")

    # Validate commands_run
    if "commands_run" in evidence:
        commands_run = evidence["commands_run"]
        if not isinstance(commands_run, list):
            result.add_issue("commands_run must be a list")
        else:
            for cmd in commands_run:
                if not isinstance(cmd, str):
                    result.add_issue(f"commands_run entry is not a string: {cmd}")

    # Validate criteria_checklist
    if "criteria_checklist" in evidence:
        checklist = evidence["criteria_checklist"]
        if not isinstance(checklist, dict):
            result.add_issue("criteria_checklist must be a dict")
        else:
            for key, value in checklist.items():
                if not isinstance(value, bool):
                    result.add_issue(f"criteria_checklist['{key}'] must be a boolean")

    # Validate lint_passed is boolean
    if "lint_passed" in evidence:
        if not isinstance(evidence["lint_passed"], bool):
            result.add_issue("lint_passed must be a boolean")

    return result


def _validate_text_quality(
    text: str,
    field_name: str,
    min_length: int,
    result: EvidenceValidationResult,
    strict_mode: bool,
) -> None:
    """Check that text is not vague or too short."""
    text_stripped = text.strip()

    # Check length
    if len(text_stripped) < min_length:
        if strict_mode:
            result.add_issue(f"{field_name} is too short (min {min_length} chars, got {len(text_stripped)})")
        else:
            result.add_warning(f"{field_name} is very short ({len(text_stripped)} chars)")

    # Check for vague patterns
    text_lower = text_stripped.lower()
    for pattern in VAGUE_PATTERNS:
        if re.match(pattern, text_lower, re.IGNORECASE):
            if strict_mode:
                result.add_issue(f"{field_name} is too vague: '{text_stripped}'")
            else:
                result.add_warning(f"{field_name} may be too vague: '{text_stripped}'")
            break


def validate_summary(summary: str, strict_mode: bool = False) -> EvidenceValidationResult:
    """Validate the attempt summary text."""
    result = EvidenceValidationResult()
    _validate_text_quality(summary, "summary", MIN_SUMMARY_LENGTH, result, strict_mode)
    return result


def merge_validation_results(*results: EvidenceValidationResult) -> EvidenceValidationResult:
    """Merge multiple validation results into one."""
    merged = EvidenceValidationResult()
    for r in results:
        merged.issues.extend(r.issues)
        merged.warnings.extend(r.warnings)
    return merged
