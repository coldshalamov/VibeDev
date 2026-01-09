"""Tests for the evidence validation module."""

from pathlib import Path
import tempfile

from vibedev_mcp.evidence import (
    validate_evidence,
    validate_summary,
    merge_validation_results,
    EvidenceValidationResult,
)


class TestEvidenceValidationResult:
    def test_is_valid_when_no_issues(self):
        result = EvidenceValidationResult()
        assert result.is_valid is True

    def test_is_valid_when_has_issues(self):
        result = EvidenceValidationResult()
        result.add_issue("test issue")
        assert result.is_valid is False

    def test_warnings_dont_invalidate(self):
        result = EvidenceValidationResult()
        result.add_warning("test warning")
        assert result.is_valid is True

    def test_to_dict(self):
        result = EvidenceValidationResult()
        result.add_issue("issue1")
        result.add_warning("warning1")
        d = result.to_dict()
        assert d["valid"] is False
        assert "issue1" in d["issues"]
        assert "warning1" in d["warnings"]


class TestValidateEvidence:
    def test_missing_required_fields(self):
        result = validate_evidence(
            evidence={},
            required_fields=["changed_files", "tests_passed"],
        )
        assert result.is_valid is False
        assert "changed_files" in str(result.issues)
        assert "tests_passed" in str(result.issues)

    def test_null_required_field(self):
        result = validate_evidence(
            evidence={"changed_files": None},
            required_fields=["changed_files"],
        )
        assert result.is_valid is False
        assert "null" in str(result.issues).lower()

    def test_empty_string_required_field(self):
        result = validate_evidence(
            evidence={"diff_summary": "  "},
            required_fields=["diff_summary"],
        )
        assert result.is_valid is False
        assert "empty" in str(result.issues).lower()

    def test_empty_list_required_field(self):
        result = validate_evidence(
            evidence={"changed_files": []},
            required_fields=["changed_files"],
        )
        assert result.is_valid is False
        assert "empty list" in str(result.issues).lower()

    def test_valid_evidence_passes(self):
        result = validate_evidence(
            evidence={
                "changed_files": ["src/main.py"],
                "tests_passed": True,
                "diff_summary": "Added a new feature to handle authentication properly",
            },
            required_fields=["changed_files", "tests_passed", "diff_summary"],
        )
        assert result.is_valid is True
        assert len(result.issues) == 0

    def test_changed_files_must_be_list(self):
        result = validate_evidence(
            evidence={"changed_files": "src/main.py"},
            required_fields=[],
        )
        assert result.is_valid is False
        assert "list" in str(result.issues).lower()

    def test_tests_passed_must_be_boolean(self):
        result = validate_evidence(
            evidence={"tests_passed": "yes"},
            required_fields=[],
        )
        assert result.is_valid is False
        assert "boolean" in str(result.issues).lower()

    def test_criteria_checklist_must_be_dict_of_bools(self):
        result = validate_evidence(
            evidence={"criteria_checklist": {"c1": "yes"}},
            required_fields=[],
        )
        assert result.is_valid is False
        assert "boolean" in str(result.issues).lower()

    def test_valid_criteria_checklist(self):
        result = validate_evidence(
            evidence={"criteria_checklist": {"c1": True, "c2": False}},
            required_fields=[],
        )
        assert result.is_valid is True

    def test_commands_run_must_be_list_of_strings(self):
        result = validate_evidence(
            evidence={"commands_run": [123, 456]},
            required_fields=[],
        )
        assert result.is_valid is False

    def test_file_existence_validation_with_repo_root(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create a real file
            real_file = Path(tmpdir) / "real.py"
            real_file.write_text("# real file")

            result = validate_evidence(
                evidence={"changed_files": ["real.py", "fake.py"]},
                required_fields=[],
                repo_root=tmpdir,
                strict_mode=True,
            )
            # In strict mode, fake.py not existing is an issue
            assert result.is_valid is False
            assert "fake.py" in str(result.issues)

    def test_file_existence_warning_in_loose_mode(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            result = validate_evidence(
                evidence={"changed_files": ["nonexistent.py"]},
                required_fields=[],
                repo_root=tmpdir,
                strict_mode=False,
            )
            # In loose mode, missing files are warnings
            assert result.is_valid is True
            assert "nonexistent.py" in str(result.warnings)

    def test_diff_summary_too_short_strict(self):
        result = validate_evidence(
            evidence={"diff_summary": "done"},
            required_fields=[],
            strict_mode=True,
        )
        assert result.is_valid is False
        assert "short" in str(result.issues).lower() or "vague" in str(result.issues).lower()

    def test_diff_summary_vague_strict(self):
        result = validate_evidence(
            evidence={"diff_summary": "done."},
            required_fields=[],
            strict_mode=True,
        )
        assert result.is_valid is False

    def test_diff_summary_vague_patterns(self):
        vague_summaries = ["done", "fixed", "works", "updated", "completed", "implemented"]
        for summary in vague_summaries:
            result = validate_evidence(
                evidence={"diff_summary": summary},
                required_fields=[],
                strict_mode=True,
            )
            assert result.is_valid is False, f"Should reject vague summary: {summary}"


class TestValidateSummary:
    def test_valid_summary(self):
        result = validate_summary("Implemented the authentication middleware with JWT validation")
        assert result.is_valid is True

    def test_short_summary_warning(self):
        result = validate_summary("done", strict_mode=False)
        assert result.is_valid is True
        assert len(result.warnings) > 0

    def test_short_summary_strict(self):
        result = validate_summary("done", strict_mode=True)
        assert result.is_valid is False


class TestMergeValidationResults:
    def test_merge_combines_issues(self):
        r1 = EvidenceValidationResult()
        r1.add_issue("issue1")
        r2 = EvidenceValidationResult()
        r2.add_issue("issue2")
        merged = merge_validation_results(r1, r2)
        assert len(merged.issues) == 2
        assert "issue1" in merged.issues
        assert "issue2" in merged.issues

    def test_merge_combines_warnings(self):
        r1 = EvidenceValidationResult()
        r1.add_warning("warn1")
        r2 = EvidenceValidationResult()
        r2.add_warning("warn2")
        merged = merge_validation_results(r1, r2)
        assert len(merged.warnings) == 2
