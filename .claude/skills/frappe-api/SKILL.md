---
name: frappe-api
description: Correct patterns for talking to a Frappe backend from this app — which RPC to call for what, CSRF and auth, error/message parsing, and the server-state vs. UI-state boundary. Use whenever writing or reviewing code that fetches, saves, lists, or deletes a Document, or that touches useDocumentStore / DocumentModel / FormController / ListController.
---

# Frappe API patterns for frappe-react-ui

Full content lives in [`docs/agent-rules/frappe-api.md`](../../../docs/agent-rules/frappe-api.md)
so it's readable by any agent working in this repo, not just Claude — read it before writing or
reviewing any code that touches the network.

Covers: which Desk RPC to call for what (and their real, verified response shapes — several
differ from what the docs suggest); the standalone-SPA same-site-subdomain auth strategy and the
`allowed_referrers` CSRF bypass; error/`_server_messages` parsing; the server-state vs. UI-state
boundary (the root cause of this codebase's worst bug, C1); Dynamic Link scope; and the two
different "permission" shapes Frappe returns.
