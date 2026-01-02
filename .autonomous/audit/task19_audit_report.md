# Task 19: Audit Report (Draft)

Date: 2026-01-01

This is a filled-in draft based on Tasks 1–18. It is intended to be a “single doc” you can hand to yourself later (or to collaborators) to guide tightening work.

## 1) Executive Summary

Overall posture: **Good bones, incomplete glass-box enforcement.**

Strengths:
- Clear conceptual model (planning vs execution) and a concrete gate engine in `vibedev_mcp/store.py`.
- Safe-by-default shell gating (`enable_shell_gates=false` unless explicitly enabled; allowlist required).
- CI exists and is reasonably scoped (`.github/workflows/ci.yml`).

Top tightening opportunities:
- Persist and display **machine-verifiable evidence** (command outputs) to meet the “no claims without evidence” standard.
- Close gaps between **docs promises** (FlowGraph/RunnerActions/UI trust panes) and **current implementation**.
- Add explicit protection/guardrails around the HTTP API if it’s ever exposed beyond localhost.

Quick wins (high leverage, low churn):
- Validate `model_claim` as an enum in the HTTP API.
- Add a “Gate Results” panel in the UI using existing `rejection_reasons` + `missing_fields`, and extend backend to provide per-gate results.
- Add a dev script that standardizes Python env setup (venv + install).

## 2) Scope & Objectives

Scope: backend (`vibedev_mcp/`), frontend (`vibedev-ui/`), docs, CI config, and safety boundaries.

Objectives:
- Identify risks in tools/API/UI
- Verify persistence + secrets handling
- Spot dependency + supply-chain concerns
- Produce a concrete remediation roadmap

## 3) Methodology

- Static review of key modules (`server.py`, `http_server.py`, `store.py`, `models.py`, `templates.py`, UI components).
- Secret-pattern scan (excluding `node_modules`, `dist`, `.autonomous`).
- Runtime verification (follow-up):
  - Python tests executed successfully in a WSL virtualenv.
  - HTTP API served and `/api/templates` responded successfully.

## 4) System Overview

High level:
- Backend serves both MCP tools (stdio) and HTTP API (REST + SSE).
- Store uses SQLite (`~/.vibedev/vibedev.sqlite3` by default).
- UI uses React/Vite and polls state + connects to SSE.

Key entrypoints:
- `vibedev-mcp` → `vibedev_mcp/server.py:main`
- `vibedev-mcp serve` → `vibedev_mcp/http_server.py:serve_main`
- UI: `vibedev-ui/src/main.tsx`

## 5) Findings

See `.autonomous/audit/task18_findings.md` for the detailed list.

## 6) Risk Summary Table

| ID | Title | Severity | Component | Status |
|----|-------|----------|-----------|--------|
| F-01 | HTTP API has no auth | Medium | Backend HTTP | Open |
| F-02 | Command outputs not persisted | Medium | Store/UI | Open |
| F-03 | “Required but unverifiable” policy combos | Low/Med | Policies | Open |
| F-04 | Missing UI trust panes | Low/Med | UI | Open |
| F-05 | `model_claim` stringly typed | Low | HTTP API | Fixed (2026-01-01) |
| F-06 | WSL/dev UX mismatch | Info | Tooling | Open |

## 7) Remediation Roadmap

See `.autonomous/audit/task20_roadmap.md`.

## 8) Open Questions / Assumptions

- Is the HTTP server ever expected to be reachable outside localhost? If yes, auth becomes urgent.
- Is FlowGraph/RunnerActions implementation in-scope for the near term, or are they aspirational docs?
- What is the canonical “truth source” for gate results: store-only, or store + runner?

## 9) Appendices

- Inventory: `.autonomous/audit/inventory.md`
- Scope: `.autonomous/audit/audit_scope.md`
- MCP tools: `.autonomous/audit/task6_mcp_tools.md`
- HTTP API notes: `.autonomous/audit/task7_http_api.md`
- Dependencies: `.autonomous/audit/task9_dependencies.md`
- Secrets scan: `.autonomous/audit/task10_secrets_scan.md`
