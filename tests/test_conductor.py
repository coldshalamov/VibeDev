def test_compute_next_questions_surfaces_missing_planning_artifacts():
    from vibedev_mcp.conductor import compute_next_questions

    job = {
        "deliverables": [],
        "definition_of_done": [],
        "invariants": None,
        "repo_root": None,
        "step_order": [],
        "planning_answers": {},
        "policies": {},
    }

    qs = compute_next_questions(job)
    assert qs[0]["phase"] == 1
    keys = {q["key"] for q in qs}
    assert "repo_exists" in keys
    assert "out_of_scope" in keys
    assert "target_environment" in keys


def test_compute_next_questions_advances_to_deliverables_after_phase1_answers():
    from vibedev_mcp.conductor import compute_next_questions

    job = {
        "deliverables": [],
        "definition_of_done": [],
        "invariants": None,
        "repo_root": None,
        "step_order": [],
        "planning_answers": {
            "repo_exists": True,
            "out_of_scope": ["No web UI"],
            "target_environment": {"os": "Windows", "runtime": "Python"},
            "timeline_priority": "MVP",
        },
        "policies": {},
    }

    qs = compute_next_questions(job)
    assert qs[0]["phase"] == 2
    keys = {q["key"] for q in qs}
    assert "deliverables" in keys
    assert "definition_of_done" in keys
