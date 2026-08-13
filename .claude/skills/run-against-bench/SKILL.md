---
name: run-against-bench
description: How to boot a real Frappe/ERPNext backend locally to test frappe-react-ui against — the vyogo SNE image, its default site and credentials, and how to point the Vite dev server at it. Use whenever asked to run, test, or screenshot this app, or to verify a fix against a live bench rather than just reading the code.
---

# Running against a live bench

Full content lives in
[`docs/agent-rules/run-against-bench.md`](../../../docs/agent-rules/run-against-bench.md) so it's
readable by any agent working in this repo, not just Claude — read it before booting a container
or claiming something works without checking it live.

Covers: the SNE container images (MariaDB and Postgres variants) and their credentials/ports; a
known local redis-boot flakiness on arm64/podman; the Vite dev proxy (dev ergonomics **only** —
never what E2E or CI run against) versus the same-site cross-origin `*.localtest.me` setup that
`playwright.config.ts` actually uses; and the recorded-fixtures alternative for tests that don't
need a live container at all.
