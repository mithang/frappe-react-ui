---
name: add-field-renderer
description: Recipe for adding or overriding a field renderer in frappe-react-ui's metadata-driven form engine — the FieldRegistry/DocTypeRegistry/FieldDispatcher contract, where to register at which scope, and the known gotchas that have caused real bugs. Use whenever adding support for a new Frappe fieldtype, or overriding how one specific doctype/field renders.
---

# Adding a field renderer

Full content lives in
[`docs/agent-rules/add-field-renderer.md`](../../../docs/agent-rules/add-field-renderer.md) so
it's readable by any agent working in this repo, not just Claude — read it before touching a
field renderer.

Covers: the `FieldRendererProps` contract; the three-level resolution chain (`DocTypeRegistry` →
`FieldRegistry` → fallback) and which scope to register a new renderer at; the cmdk lowercasing
trap (C5) and the `__islocal` child-row trap (C7), both of which have already corrupted real data
in this codebase; and how to verify against a live bench instead of just eyeballing it.
