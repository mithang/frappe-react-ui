#!/usr/bin/env node
// Client Script inventory (1C) — queries a bench for enabled Client Script records and
// statically greps each script body for the frm/frappe API surface it actually calls. This is
// what sizes 3B's compatibility-shim work: build the 80/20 surface THIS deployment's scripts
// actually use, not a guess at Frappe's whole client API.
//
// IMPORTANT: run this against the CUSTOMER's real bench, not a vanilla SNE container — a vanilla
// site has no custom Client Scripts and will report an empty surface, which is misleading, not
// reassuring (see docs/agent-rules — the plan is explicit about this trap).
//
// Usage:
//   BENCH_URL=https://erp.acme.com FRAPPE_SID=<session-cookie-value> node scripts/client-script-inventory.mjs
// or interactively:
//   BENCH_URL=... FRAPPE_USER=Administrator FRAPPE_PASSWORD=... node scripts/client-script-inventory.mjs

const BENCH_URL = process.env.BENCH_URL;
if (!BENCH_URL) {
  console.error('Set BENCH_URL to the target bench, e.g. BENCH_URL=https://erp.acme.com');
  process.exit(1);
}

// The 80/20 API surface the plan's Client Script migration strategy names as what the
// compatibility shim (3B) will actually implement. Anything else found in a script body is
// flagged as needing hand-porting, not silently ignored.
const SUPPORTED_PATTERNS = [
  /frm\.doc\b/, /frm\.set_value\b/, /frm\.get_value\b/,
  /frm\.set_df_property\b/, /frm\.toggle_display\b/, /frm\.toggle_reqd\b/, /frm\.toggle_read_only\b/,
  /frm\.add_custom_button\b/, /frm\.set_query\b/,
  /frm\.refresh_field\b/, /frm\.save\b/, /frm\.call\b/,
  /frm\.add_child\b/, /frm\.clear_table\b/,
  /frappe\.call\b/, /frappe\.db\.get_value\b/, /frappe\.msgprint\b/, /frappe\.throw\b/,
];

// Known-unsupportable per the plan — these need hand-porting, no shim will cover them.
const UNSUPPORTED_PATTERNS = [
  { pattern: /\$\(|jQuery\(/, label: 'jQuery/$' },
  { pattern: /\bcur_frm\b/, label: 'cur_frm global' },
  { pattern: /frappe\.ui\.form\.Control\w*/, label: 'frappe.ui.form.Control* internals' },
  { pattern: /document\.(getElementById|querySelector)/, label: 'direct DOM manipulation' },
];

async function login() {
  if (process.env.FRAPPE_SID) return { Cookie: `sid=${process.env.FRAPPE_SID}` };

  const user = process.env.FRAPPE_USER;
  const password = process.env.FRAPPE_PASSWORD;
  if (!user || !password) {
    console.error('Set FRAPPE_SID, or FRAPPE_USER + FRAPPE_PASSWORD.');
    process.exit(1);
  }

  const res = await fetch(`${BENCH_URL}/api/method/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ usr: user, pwd: password }),
  });
  const setCookie = res.headers.get('set-cookie') ?? '';
  const sidMatch = setCookie.match(/sid=([^;]+)/);
  if (!res.ok || !sidMatch) {
    console.error('Login failed:', res.status, await res.text());
    process.exit(1);
  }
  return { Cookie: `sid=${sidMatch[1]}` };
}

async function main() {
  const authHeaders = await login();

  const res = await fetch(`${BENCH_URL}/api/method/frappe.client.get_list`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({
      doctype: 'Client Script',
      filters: { enabled: 1 },
      fields: ['name', 'dt', 'view', 'script_type', 'script'],
      limit_page_length: 0,
    }),
  });
  if (!res.ok) {
    console.error('Failed to fetch Client Script records:', res.status, await res.text());
    process.exit(1);
  }
  const { message: scripts } = await res.json();

  if (!scripts?.length) {
    console.log(
      'No enabled Client Script records found. If this is meant to be a customer bench with ' +
        'real customizations, this is suspicious, not reassuring — verify you pointed BENCH_URL ' +
        'at the right site, not a vanilla SNE container.'
    );
    return;
  }

  const report = scripts.map((s) => {
    const body = s.script ?? '';
    const supported = SUPPORTED_PATTERNS.filter((p) => p.test(body)).map((p) => p.source);
    const unsupported = UNSUPPORTED_PATTERNS.filter((u) => u.pattern.test(body)).map((u) => u.label);
    const status = unsupported.length ? 'unsupported' : supported.length ? 'supported' : 'unknown';
    return { name: s.name, doctype: s.dt, view: s.view, status, supported, unsupported };
  });

  const counts = { supported: 0, unsupported: 0, unknown: 0 };
  for (const r of report) counts[r.status]++;

  console.log(`\nClient Script inventory — ${scripts.length} enabled script(s):\n`);
  for (const r of report) {
    console.log(`[${r.status}] ${r.name} (${r.doctype}, ${r.view})`);
    if (r.supported.length) console.log(`  uses: ${r.supported.join(', ')}`);
    if (r.unsupported.length) console.log(`  NEEDS HAND-PORTING: ${r.unsupported.join(', ')}`);
  }
  console.log(`\nSummary: ${counts.supported} supported, ${counts.unsupported} need hand-porting, ${counts.unknown} unclear (empty or unrecognized body).`);
  console.log('This summary is 3B\'s migration backlog — see the plan\'s "Existing Client Scripts" section.');
}

main();
