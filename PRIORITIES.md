# 🎯 VibeDev Implementation Priorities

**Based on comprehensive audit (2026-01-17)**  
**Status:** 85% Complete, Production-Ready Core

---

## 🔴 P0: Immediate Actions (This Week)

### 1. Fix Documentation Drift ⏱️ 2 days
**Why:** Creates false perception of incompleteness

**Tasks:**
- [ ] Add "Implementation Status" badge to README.md
- [ ] Update docs/00_overview.md with current state
- [ ] Mark implemented features as ✅ in all docs
- [ ] Create "Future Enhancements" section for unimplemented features
- [ ] Update COMPLETION_SUMMARY.md to reflect reality

**Impact:** High - Changes perception from "broken" to "ready"

---

### 2. Add Gate Results Panel to UI ⏱️ 3 days
**Why:** Users can't see which gates passed/failed (trust gap)

**Files to modify:**
- `vibedev_mcp/http_server.py` - Add gate results endpoint if needed
- `vibedev-ui/src/components/GateResultsPanel.tsx` - New component
- `vibedev-ui/src/components/ExecutionDashboard.tsx` - Integrate panel

**Implementation:**
```typescript
// Fetch gate results from API
const { data: gateResults } = useSWR(
  `/api/jobs/${jobId}/steps/${stepId}/gate-results`
);

// Display each gate
<GateResultsPanel results={gateResults} />
```

**Acceptance Criteria:**
- [ ] Shows pass/fail for each gate
- [ ] Displays command output for failed gates
- [ ] Updates in real-time via SSE
- [ ] Collapsible for long outputs

**Impact:** High - Core transparency feature

---

### 3. Add E2E Test ⏱️ 2 days
**Why:** No validation of complete user flows

**Test Flow:**
```python
def test_complete_workflow():
    # 1. Create job
    job_id = await create_job(title="Test", goal="Complete workflow")
    
    # 2. Complete planning
    await submit_planning_answers(job_id, {...})
    await set_deliverables(job_id, ["Feature X"])
    await set_invariants(job_id, ["Test coverage > 80%"])
    
    # 3. Set READY
    await transition_to_ready(job_id)
    
    # 4. Execute step
    prompt = await get_step_prompt(job_id)
    await submit_step_result(job_id, step_id, {
        "model_claim": "MET",
        "summary": "Implemented feature",
        "evidence": {...}
    })
    
    # 5. Verify completion
    job = await get_job(job_id)
    assert job.status == "COMPLETE"
```

**Files to create:**
- `tests/test_e2e_workflow.py`

**Impact:** Critical - Validates user experience

---

## 🟡 P1: User Experience (2-3 Weeks)

### 4. Add Injection Preview Panel ⏱️ 1 week
**Why:** Can't see what context is injected (transparency)

**Implementation:**
- Add endpoint to preview prompt with injections
- Create UI panel showing base vs injected prompt
- Highlight injected sections

**Files:**
- `vibedev_mcp/http_server.py` - `/api/jobs/{jobId}/steps/{stepId}/preview`
- `vibedev-ui/src/components/InjectionPreviewPanel.tsx`

**Impact:** Medium-High - Important for trust

---

### 5. Add Next Action Preview ⏱️ 3 days
**Why:** Users don't know what happens after submit

**Implementation:**
- Show "Next: Step S2" or "Next: Job Complete"
- Display decision logic (gate results → action)

**Files:**
- `vibedev_mcp/http_server.py` - Compute next action
- `vibedev-ui/src/components/NextActionPreview.tsx`

**Impact:** Medium - Reduces uncertainty

---

### 6. Automate Diagnose Step ⏱️ 1 week
**Why:** Manual diagnose step insertion is error-prone

**Implementation:**
```python
async def handle_retry_exhaustion(step):
    # Auto-insert diagnose step
    diagnose_step = create_diagnose_step(
        failure_reasons=step.rejection_reasons,
        gate_results=step.gate_results
    )
    await insert_step(job_id, diagnose_step, before=step.id)
    await record_mistake(job_id, failure)
```

**Files:**
- `vibedev_mcp/store.py` - Update `_evaluate_step_gates`
- `vibedev_mcp/templates.py` - Add diagnose template

**Impact:** Medium-High - Improves failure handling

---

### 7. Expand UI Test Coverage ⏱️ 1 week
**Why:** Only ~20% of UI components tested

**Goal:** Reach 50% coverage

**Prioritize:**
- [ ] GateResultsPanel (new component)
- [ ] InjectionPreviewPanel (new component)
- [ ] Step execution flow
- [ ] Evidence submission
- [ ] Error handling

**Files:**
- `vibedev-ui/src/components/*.test.tsx` (new)

**Impact:** Medium - Reduces regression risk

---

### 8. Performance Audit ⏱️ 3 days
**Why:** Ensure UI is responsive (<100ms renders)

**Tasks:**
- Profile React re-renders
- Add database indexes if needed
- Optimize SSE event handling
- Bundle size analysis

**Tools:**
- React DevTools Profiler
- Chrome DevTools
- `npm run build -- --report`

**Impact:** Medium - User experience improvement

---

## 🟢 P2: Feature Enhancements (1 Month)

### 9. Implement `json_schema_valid` Gate ⏱️ 2 days
**Why:** Only missing gate type (1 of 17)

**Implementation:**
```python
async def evaluate_gate_json_schema_valid(gate, evidence):
    file_path = gate.parameters["path"]
    schema = gate.parameters["schema"]
    
    with open(file_path) as f:
        data = json.load(f)
    
    try:
        jsonschema.validate(data, schema)
        return GateResult(passed=True, ...)
    except jsonschema.ValidationError as e:
        return GateResult(passed=False, details=str(e))
```

**Impact:** Low - Completeness

---

### 10. Process Templates System ⏱️ 2 weeks
**Why:** High-value user feature (reusable workflows)

**Implementation:**
- Template library UI
- Create templates from completed jobs
- Template categorization and search
- Community template sharing (future)

**Files:**
- `vibedev-ui/src/components/TemplateLibrary.tsx`
- `vibedev-ui/src/components/TemplateEditor.tsx`

**Impact:** High - Major user value

---

### 11. Advanced Evidence Validation ⏱️ 1 week
**Why:** Current validation is basic (presence checking)

**Enhancements:**
- Parse test output (pytest, jest, etc.)
- Validate diff format
- Check file existence automatically
- Semantic validation (e.g., "tests_passed" matches test output)

**Files:**
- `vibedev_mcp/evidence.py` - Add validation parsers

**Impact:** Medium - Improves trustworthiness

---

### 12. Full Runner Automation ⏱️ 1 week
**Why:** Brain/hands separation is partially implemented

**Implementation:**
- Automate thread resets
- Auto-paste prompts
- Auto-submit evidence (with confirmation)
- VS Code extension integration

**Files:**
- `vibedev-vscode/` - Expand extension
- `vibedev_mcp/runner.py` - New module

**Impact:** Low-Medium - Nice-to-have

---

## 📊 Priority Matrix

| Feature | User Value | Effort | Priority |
|---------|-----------|--------|----------|
| Fix Documentation | High | Low | 🔴 P0 |
| Gate Results Panel | High | Low | 🔴 P0 |
| E2E Tests | High | Low | 🔴 P0 |
| Injection Preview | Med-High | Low | 🟡 P1 |
| Next Action Preview | Medium | Low | 🟡 P1 |
| Auto Diagnose | Med-High | Medium | 🟡 P1 |
| UI Test Coverage | Medium | Medium | 🟡 P1 |
| Performance Audit | Medium | Low | 🟡 P1 |
| json_schema gate | Low | Low | 🟢 P2 |
| Process Templates | High | High | 🟢 P2 |
| Adv Validation | Medium | Medium | 🟢 P2 |
| Full Automation | Low-Med | Medium | 🟢 P2 |

---

## 🎯 30-Day Roadmap

### Week 1: P0 - Ship It
- Day 1-2: Fix documentation drift
- Day 3-5: Add Gate Results Panel
- Day 6-7: Add E2E test

**Deliverable:** Production-ready with updated docs

### Week 2-3: P1 - Polish
- Add Injection Preview Panel
- Add Next Action Preview
- Automate Diagnose step
- Expand UI test coverage
- Performance audit

**Deliverable:** Polished user experience

### Week 4: Harden
- Bug fixes from user feedback
- Performance optimizations
- Documentation improvements

**Deliverable:** Stable v1.0

---

## 💰 Resource Estimates

| Phase | Duration | Engineer | Effort |
|-------|----------|----------|--------|
| P0 (Immediate) | 1 week | 1 senior | 40 hours |
| P1 (Polish) | 2 weeks | 1 senior | 80 hours |
| P2 (Features) | 1 month | 1 senior | 160 hours |
| **Total** | **2 months** | **1 senior** | **280 hours** |

**Recommendation:** Do P0 this week, then gather user feedback before investing heavily in P1/P2.

---

## ✅ Success Criteria

### P0 Complete When:
- [ ] README clearly states "85% complete, production-ready core"
- [ ] All docs have "Implementation Status" sections
- [ ] Gate Results Panel shows pass/fail for all gates
- [ ] E2E test validates complete workflow
- [ ] 140/140 tests still passing

### P1 Complete When:
- [ ] UI has 50%+ test coverage
- [ ] All trust surfaces implemented (gates, injection, next action)
- [ ] Diagnose step auto-inserts on retry exhaustion
- [ ] Performance audit shows <100ms renders

### P2 Complete When:
- [ ] All 17 gate types implemented
- [ ] Process Templates system complete
- [ ] Advanced validation parsing test outputs
- [ ] Runner automation fully implemented

---

## 🚀 Decision Matrix

**Question: Should we ship now?**

Answer: **YES, with updated docs**

The core is production-ready. The documentation drift is creating a false perception of incompleteness. Fix the docs, add the Gate Results Panel for transparency, and ship.

**Question: What should we work on next?**

Answer: **User feedback**

Add the P0 items (docs + gate panel + E2E test), then gather real user feedback. Let users tell us what P1/P2 features matter most rather than building everything speculatively.

---

**Last Updated:** 2026-01-17  
**Status:** Ready for immediate execution
