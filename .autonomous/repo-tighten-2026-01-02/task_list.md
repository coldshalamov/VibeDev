# Repo Tighten — 2026-01-02

Master checklist for an exhaustive repo audit + small tightening patch-set.

## Task List

- [ ] Read scoped `AGENTS.md` + `CLAUDE.md` rules
- [ ] Read canonical docs (`docs/00_overview.md` → `docs/07_doc_map.md`)
- [ ] Inventory backend (`vibedev_mcp/`) entrypoints and surfaces
- [ ] Inventory UI (`vibedev-ui/`) entrypoints and proxy assumptions
- [ ] Run backend tests (`python -m pytest -v`)
- [ ] Run UI lint (`cd vibedev-ui; npm run lint`)
- [ ] Run dependency audits (Python + npm, best-effort)
- [ ] Run security scan (secrets + obvious injection patterns, best-effort)
- [ ] Identify top issues and rank by risk/ROI
- [ ] Implement small, low-risk tightening fixes (scoped)
- [ ] Update docs to match any changes (scoped)
- [ ] Re-run verification commands and summarize evidence

