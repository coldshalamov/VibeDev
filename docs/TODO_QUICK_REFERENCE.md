# VibeDev TODOs & Gaps - Quick Reference

## 🚨 Priority 1: Critical (Must Fix)

### 1. Gate System
- **TODO:** Implement `json_schema_valid` gate
  - Location: `vibedev_mcp/store.py:1587+` (add new gate type)
  - Impact: Required for structured data validation
  - Effort: 2 days

### 2. FlowGraph Failure Loops
- **TODO:** Implement diagnose step pattern
  - Location: `vibedev_mcp/store.py:2140-2200` (modify attempt submission)
  - Impact: Critical for robust failure handling
  - Effort: 1 week
  
- **TODO:** Enforce escalation policies deterministically
  - Location: `vibedev_mcp/store.py:2191` (add escalation engine)
  - Impact: Missing from current simplified flow
  - Effort: 3 days

### 3. Evidence Validation
- **TODO:** Parse and validate `tests_run` commands
  - Location: `vibedev_mcp/evidence.py:1-50` (new validation module)
  - Impact: Reduces fabricated test evidence
  - Effort: 2 days
  
- **TODO:** Validate `changed_files` paths exist
  - Location: `vibedev_mcp/evidence.py:50-100`
  - Impact: Catches invalid file paths
  - Effort: 1 day

---

## ⚠️ Priority 2: High Value (Should Implement)

### 4. Process Templates
- **TODO:** Create template persistence layer
  - Location: `vibedev_mcp/templates.py` (enhance)
  - Impact: Enables repeatable workflows
  - Effort: 1 week
  
- **TODO:** Add template endpoints to HTTP API
  - Location: `vibedev_mcp/http_server.py:600-700` (add routes)
  - Impact: UI needs endpoints to manage templates
  - Effort: 2 days

### 5. RepoMap Dependencies
- **TODO:** Implement dependency tracking
  - Location: `vibedev_mcp/repo.py:200-300` (add functions)
  - Impact: Impact analysis before changes
  - Effort: 1 week
  
- **TODO:** Add dependency queries to store
  - Location: `vibedev_mcp/store.py:2500-2600` (add methods)
  - Impact: Required for visualization
  - Effort: 3 days

### 6. Checkpoint Automation
- **TODO:** Implement automatic checkpoint insertion
  - Location: `vibedev_mcp/store.py:2250-2300`
  - Impact: Prevents lost work
  - Effort: 3 days

### 7. Interactive CLI
- **TODO:** Create REPL interface
  - Location: `vibedev_mcp/cli.py:200-400` (new commands)
  - Impact: Improves developer experience
  - Effort: 1 week

---

## 🔧 Priority 3: UI/UX (Important for Adoption)

### 8. MainCanvas
- **TODO:** Implement drag-and-drop step reordering
  - Location: `vibedev-ui/src/components/MainCanvas.tsx:100-200`
  - Impact: Critical UX improvement
  - Effort: 1 week
  
- **TODO:** Add step templates library
  - Location: `vibedev-ui/src/components/MainCanvas.tsx:300-400`
  - Impact: Reduces planning time
  - Effort: 1 week

### 9. ExecutionDashboard
- **TODO:** Dynamic evidence form builder
  - Location: `vibedev-ui/src/components/ExecutionDashboard.tsx:80-150`
  - Impact: Makes evidence submission easier
  - Effort: 1 week
  
- **TODO:** Inline diff viewer
  - Location: `vibedev-ui/src/components/DiffViewer.tsx` (new file)
  - Impact: Improves evidence review
  - Effort: 3 days

### 10. Testing Infrastructure
- **TODO:** Add HTTP integration tests
  - Location: `tests/test_http_server.py` (new file)
  - Impact: Critical for reliability
  - Effort: 1 week
  
- **TODO:** Add E2E tests with Playwright
  - Location: `tests/e2e/` (new folder)
  - Impact: Prevents regressions
  - Effort: 2 weeks

---

## 📋 Complete Todo List by File

### Backend (`vibedev_mcp/`)

#### `store.py`
- [ ] Add `json_schema_valid` gate case (line ~1587)
- [ ] Implement diagnose step insertion (lines 2140-2200)
- [ ] Add escalation policy engine (line ~2191)
- [ ] Implement checkpoint auto-insertion (lines 2250-2300)
- [ ] Add template management methods (lines ~2600-2800)
- [ ] Add dependency tracking methods (lines ~2500-2600)

#### `gates.py`
- [ ] Add JSON Schema validator function
- [ ] Add caching layer for expensive gates
- [ ] Implement gate result caching

#### `evidence.py`
- [ ] Create `EvidenceValidator` class
- [ ] Add `tests_run` parsing and validation
- [ ] Add `changed_files` path validation
- [ ] Add `diff_summary` quality checks

#### `templates.py`
- [ ] Enhance with persistence layer
- [ ] Add template CRUD operations
- [ ] Implement template versioning

#### `http_server.py`
- [ ] Add `/api/templates/*` endpoints (lines ~600-700)
- [ ] Add `/api/dependencies/*` endpoints (lines ~700-750)
- [ ] Add OpenAPI spec generation endpoint

#### `repo.py`
- [ ] Add `analyze_dependencies()` function (lines ~200-300)
- [ ] Add `find_dependents()` function
- [ ] Add import statement parsing

#### `cli.py`
- [ ] Add `interactive` command (lines ~200-400)
- [ ] Add `job show` command
- [ ] Add `job export` command
- [ ] Add `template *` commands
- [ ] Add `db *` commands

### Frontend (`vibedev-ui/`)

#### `MainCanvas.tsx`
- [ ] Add drag-and-drop reordering (lines ~100-200)
- [ ] Add step templates library panel (lines ~300-400)
- [ ] Add AI-assisted step generation (lines ~400-500)
- [ ] Add rich text/Markdown editor (lines ~150-250)

#### `ExecutionDashboard.tsx`
- [ ] Dynamic form generation (lines ~80-150)
- [ ] Integrate DiffViewer component
- [ ] Integrate TestResults component
- [ ] Enhanced attempt timeline (lines ~200-300)

#### `AutomationCockpit.tsx`
- [ ] Enhanced thread manager (lines ~100-200)
- [ ] Auto-prompter implementation (lines ~250-350)
- [ ] Keyboard shortcuts system (lines ~300-400)

#### `GlobalSidebar.tsx`
- [ ] Mistake search/filter panel (lines ~150-250)
- [ ] Context block browser (lines ~300-400)
- [ ] Git integration panel (lines ~450-550)

### Components to Create

#### `DiffViewer.tsx` (new)
- [ ] Git diff display
- [ ] Syntax highlighting
- [ ] Collapsible sections

#### `TestResults.tsx` (new)
- [ ] Test output parsing
- [ ] Pass/fail visualization
- [ ] File linking

#### `EvidenceForm.tsx` (new)
- [ ] Dynamic field generation
- [ ] File picker integration
- [ ] Validation feedback

### Tests (`tests/`)

#### `test_http_server.py` (new)
- [ ] Test all GET endpoints
- [ ] Test all POST endpoints
- [ ] Test SSE events
- [ ] Test error handling

#### `e2e/` folder (new)
- [ ] Create job workflow test
- [ ] Planning phase test
- [ ] Execution loop test
- [ ] Evidence submission test
- [ ] Failure/retry test

### Documentation (`docs/`)

#### `API.md` (new)
- [ ] HTTP endpoint reference
- [ ] Request/response examples
- [ ] Error codes

#### `USER_GUIDE.md` (new)
- [ ] Getting started tutorial
- [ ] Workflow best practices
- [ ] Troubleshooting guide

#### Architecture diagrams
- [ ] System component diagram
- [ ] Data flow diagram
- [ ] State machine diagram
- [ ] Gate evaluation sequence diagram

---

## Code Quality Todos

### Refactoring

- [ ] Split `store.py` into multiple files
  - `store.py` - Data access only
  - `verifier.py` - Gate evaluation
  - `compiler.py` - Planning compilation
  - Effort: 1 week

- [ ] Create validation pipeline
  - `evidence.py` validation module
  - Composable validation rules
  - Consistent error messages
  - Effort: 3 days

### Testing

- [ ] Add unit test coverage for gates
  - Each gate type needs test cases
  - Policy validation tests
  - Error path coverage
  - Effort: 1 week

- [ ] Add component tests for UI
  - MainCanvas tests
  - ExecutionDashboard tests
  - EvidenceForm tests
  - Effort: 1 week

---

## Quick Stats

**Total TODOs:** 67 items  
**Priority 1:** 8 items (~2 weeks)  
**Priority 2:** 7 items (~3 weeks)  
**Priority 3:** 10 items (~4 weeks)  
**Estimated Total Time:** ~10 weeks (2.5 months)

**Current Focus:**
1. Gate system completion (`json_schema_valid`)
2. FlowGraph diagnose steps
3. Evidence validation pipeline

**Blocked Items:**
- Browser extension (security concerns)
- OS automation (safety concerns)
- Direct IDE integration (needs external plugin)

---

## How to Add a New TODO

When finding a gap:
1. Document in the relevant spec file under "TODOs" section
2. Add TODO comment in code: `# TODO: Description - Priority: X`
3. Update this quick reference
4. Create GitHub issue with:
   - Document reference
   - Code location
   - Expected behavior
   - Success criteria

**Template:**
```markdown
### TODO: [Brief Description]
**Document:** `docs/filename.md:line`  
**Location:** `vibedev_mcp/file.py:line`  
**Priority:** P1/P2/P3  
**Impact:** [Why this matters]  
**Effort:** [Time estimate]  
**Success Criteria:** [How to verify]
```
