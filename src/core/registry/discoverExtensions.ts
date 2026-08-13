// Loading mechanism (A9 replacement) — discovers UI extensions shipped by installed Frappe apps
// with NO SPA rebuild and none of the Webpack Module Federation runtime globals that
// ExtensionRegistry.loadRemote/doLoadRemote used to depend on (see that file's history and the
// project's defect inventory entry A9). Each installed app may optionally serve a small manifest
// at a conventional static-asset URL the bench already hosts; if present, its entry is dynamically
// imported as a plain ESM module and handed to the existing, frozen `installExtension()` pipeline.
//
// Isolation is the whole point: one app's missing manifest, network failure, malformed JSON, or
// broken extension module must never block discovery/installation of any other app's extension —
// mirrors the isolation philosophy already established in installExtension() and init.ts's
// registration loop.

import type { DefinedExtension } from '@/sdk';
import { getFrappeClient } from '@/lib/api/client';
import { loadRuntimeConfig } from '@/lib/api/config';
import { installExtension } from './installExtension';

export interface DiscoverExtensionsResult {
  installed: string[];
  skipped: { app: string; reason: string }[];
}

/**
 * Injectable in place of the real dynamic `import()` so tests can fake the module a manifest's
 * `entry` URL resolves to, without fighting vitest's handling of computed dynamic imports.
 */
export type ImportFn = (specifier: string) => Promise<unknown>;

const defaultImportFn: ImportFn = (specifier) => import(/* @vite-ignore */ specifier);

export interface DiscoverExtensionsOptions {
  /** Override the installed-app list instead of calling the RPC (tests). */
  apps?: string[];
  /** Override the dynamic import used to load an extension's entry bundle (tests). */
  importFn?: ImportFn;
  /** Override `fetch` used for manifest lookups (tests, or environments with no global fetch). */
  fetchFn?: typeof fetch;
}

interface ManifestShape {
  entry: string;
}

function isDefinedExtension(value: unknown): value is DefinedExtension {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as DefinedExtension).name === 'string' &&
    typeof (value as DefinedExtension).apiVersion === 'string' &&
    typeof (value as DefinedExtension).setup === 'function'
  );
}

/**
 * List installed Frappe apps via `frappe.utils.change_log.get_versions` — a whitelisted RPC
 * (frappe/utils/change_log.py, `@frappe.whitelist()`), the same one Desk's "About Frappe" dialog
 * calls (frappe/public/js/frappe/ui/toolbar/about.js). It returns a dict keyed by app name:
 * `{ [app: string]: { title, description, branch, color, logo, branch_version? } }`. There is no
 * whitelisted method that returns installed apps as a bare list, so the keys of this dict are
 * used as the app list.
 */
async function listInstalledApps(): Promise<string[]> {
  const client = getFrappeClient();
  const versions = await client.call<Record<string, unknown>>('frappe.utils.change_log.get_versions');
  return Object.keys(versions ?? {});
}

async function fetchManifest(app: string, benchUrl: string, fetchFn: typeof fetch): Promise<ManifestShape | null> {
  const url = `${benchUrl}/assets/${app}/ui/extension.manifest.json`;

  let res: Response;
  try {
    res = await fetchFn(url, { cache: 'no-store' });
  } catch (error) {
    console.debug(`[discoverExtensions] Manifest fetch for "${app}" failed (network error) — treating as no extension`, error);
    return null;
  }

  if (!res.ok) {
    console.debug(`[discoverExtensions] No manifest for "${app}" (HTTP ${res.status}) — treating as no extension`);
    return null;
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch (error) {
    console.debug(`[discoverExtensions] Manifest for "${app}" is not valid JSON — skipping`, error);
    return null;
  }

  const entry = (data as { entry?: unknown } | null)?.entry;
  if (typeof entry !== 'string' || entry.length === 0) {
    console.debug(`[discoverExtensions] Manifest for "${app}" is missing a string "entry" — skipping`);
    return null;
  }

  return { entry };
}

type AppOutcome = { app: string; outcome: 'installed' } | { app: string; outcome: 'skipped'; reason: string };

async function discoverOneApp(app: string, benchUrl: string, fetchFn: typeof fetch, importFn: ImportFn): Promise<AppOutcome> {
  try {
    const manifest = await fetchManifest(app, benchUrl, fetchFn);
    if (!manifest) {
      return { app, outcome: 'skipped', reason: 'no extension manifest' };
    }

    const entryUrl = /^https?:\/\//.test(manifest.entry) ? manifest.entry : `${benchUrl}${manifest.entry}`;

    const mod = await importFn(entryUrl);
    const candidate = (mod as { default?: unknown } | null)?.default;

    if (!isDefinedExtension(candidate)) {
      return { app, outcome: 'skipped', reason: 'entry module default export is not a valid extension' };
    }

    const installResult = await installExtension(candidate);
    if (!installResult.ok) {
      return { app, outcome: 'skipped', reason: installResult.error?.message ?? 'installExtension failed' };
    }

    return { app, outcome: 'installed' };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.debug(`[discoverExtensions] Skipping "${app}" after an unexpected error`, error);
    return { app, outcome: 'skipped', reason };
  }
}

/**
 * Discover and install UI extensions shipped by installed Frappe apps. Never throws — every
 * per-app step (manifest fetch, dynamic import, extension shape check, installExtension) is
 * isolated, so one app's failure can never prevent another app's valid extension from installing.
 */
export async function discoverAndInstallExtensions(options: DiscoverExtensionsOptions = {}): Promise<DiscoverExtensionsResult> {
  const result: DiscoverExtensionsResult = { installed: [], skipped: [] };

  const importFn = options.importFn ?? defaultImportFn;
  const fetchFn = options.fetchFn ?? (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : undefined);

  if (!fetchFn) {
    console.debug('[discoverExtensions] No fetch available in this environment — skipping extension discovery');
    return result;
  }

  let apps: string[];
  if (options.apps) {
    apps = options.apps;
  } else {
    try {
      apps = await listInstalledApps();
    } catch (error) {
      console.debug('[discoverExtensions] Failed to list installed apps — skipping extension discovery', error);
      return result;
    }
  }

  let benchUrl = '';
  try {
    benchUrl = (await loadRuntimeConfig()).benchUrl;
  } catch (error) {
    // loadRuntimeConfig() is designed to never throw, but stay defensive here too — an empty
    // benchUrl just means asset/manifest URLs resolve relative to the SPA's own origin.
    console.debug('[discoverExtensions] loadRuntimeConfig() threw unexpectedly — assuming same-origin bench', error);
  }

  const outcomes = await Promise.all(apps.map((app) => discoverOneApp(app, benchUrl, fetchFn, importFn)));

  for (const outcome of outcomes) {
    if (outcome.outcome === 'installed') {
      result.installed.push(outcome.app);
    } else {
      result.skipped.push({ app: outcome.app, reason: outcome.reason });
    }
  }

  return result;
}
