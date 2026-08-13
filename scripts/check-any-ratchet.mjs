#!/usr/bin/env node
// Fails CI on a lint regression over the recorded baseline, without requiring the pre-existing
// baseline itself to be fixed first — see docs/BASELINE.md: "measure regressions as a delta."
// `strict: true` (W0.10) is cheap specifically because the codebase is saturated with `any` —
// without the no-explicit-any ratchet in particular, agents satisfy the stricter compiler by
// widening types back to `any` instead of fixing them, which defeats the point of strict mode.

import { execFileSync } from 'node:child_process';

// Recorded 2026-08-13, most recently after typing SmartForm.tsx during the Wave 2A form-engine
// rewrite (see docs/BASELINE.md). Lower only, and only when the drop is genuine (a real fix),
// not by excluding files from lint's scope.
const BASELINES = {
  totalErrors: 70,
  noExplicitAny: 63,
};

function run() {
  try {
    return execFileSync('npx', ['eslint', '.', '--format', 'json'], {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 32,
    });
  } catch (err) {
    // eslint exits non-zero when there are lint errors; stdout still has the JSON report.
    if (err.stdout) return err.stdout;
    throw err;
  }
}

const results = JSON.parse(run());

let totalErrors = 0;
let noExplicitAny = 0;
for (const file of results) {
  for (const msg of file.messages ?? []) {
    if (msg.severity === 2) totalErrors++;
    if (msg.ruleId === '@typescript-eslint/no-explicit-any') noExplicitAny++;
  }
}

const counts = { totalErrors, noExplicitAny };
let failed = false;

for (const [key, baseline] of Object.entries(BASELINES)) {
  const count = counts[key];
  const status = count > baseline ? 'REGRESSION' : count < baseline ? 'improved' : 'unchanged';
  console.log(`${key}: ${count} (baseline ${baseline}) — ${status}`);
  if (count > baseline) failed = true;
}

if (failed) {
  console.error(
    `\nLint regression over baseline. Fix the new issue(s) rather than widening scope/rules to ` +
      `hide them. If every increase here is a genuine, reviewed improvement elsewhere, update ` +
      `BASELINES in this script to match — don't do that just to unblock CI.`
  );
  process.exit(1);
}

for (const [key, baseline] of Object.entries(BASELINES)) {
  if (counts[key] < baseline) {
    console.log(
      `\n${key} dropped to ${counts[key]} — lower BASELINES.${key} in ` +
        `scripts/check-any-ratchet.mjs to lock in the improvement.`
    );
  }
}
