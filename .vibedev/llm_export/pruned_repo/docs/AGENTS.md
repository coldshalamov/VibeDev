# VibeDev Docs — Agent Guide

## Canonical Docs Set

The structured docs are the canonical spec:
- `docs/00_overview.md`
- `docs/01_architecture.md`
- `docs/02_step_canvas_spec.md`
- `docs/03_gates_and_evidence.md`
- `docs/04_flow_graph_and_loops.md`
- `docs/05_studio_ui_spec.md`
- `docs/06_runner_autoprompt_spec.md`
- `docs/07_doc_map.md`

If something in a legacy doc conflicts with these, treat the structured set as canonical and log a TODO to reconcile.

## Terminology (Consistency)

Use these terms consistently:
- StepTemplate, Gate, EvidenceSchema, FlowGraph, RunnerAction, Invariant, MistakeLedger, DevLog

## Update Rules

- Prefer adding examples and schemas over long prose.
- Avoid duplicating content across docs; link to the canonical section instead.
- Keep “Compilation Surface” sections accurate when behavior changes.

---

## Compilation Surface

| Section | Maps To | Field/Policy |
|---------|---------|--------------|
| Canonical docs list | Informational | (Navigation only) |
| Terminology rules | Informational | (Writing standard) |
| Update rules | Informational | (Doc maintenance guidance) |
