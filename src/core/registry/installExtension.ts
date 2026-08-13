// Extension installation (1C) — apiVersion check + isolated setup(), so one broken extension
// degrades to "core UI plus a warning" and never takes down the whole app. Non-negotiable for a
// plugin ecosystem; this is the mechanism, not just a design intention.

import type { DefinedExtension } from '@/sdk';
import { createExtensionHost } from './ExtensionHost';

const SUPPORTED_MAJOR = 1;

export interface InstallResult {
  ok: boolean;
  error?: Error;
}

export async function installExtension(ext: DefinedExtension): Promise<InstallResult> {
  const major = Number.parseInt(ext.apiVersion.split('.')[0] ?? '', 10);
  if (!Number.isFinite(major) || major !== SUPPORTED_MAJOR) {
    const error = new Error(
      `Extension "${ext.name}" declares apiVersion "${ext.apiVersion}", but this host supports ${SUPPORTED_MAJOR}.x. Not installed.`
    );
    console.error(`[ExtensionHost] ${error.message}`);
    return { ok: false, error };
  }

  const host = createExtensionHost(ext.name);
  try {
    await ext.setup(host);
    console.log(`[ExtensionHost] Installed extension "${ext.name}" (apiVersion ${ext.apiVersion})`);
    return { ok: true };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(`[ExtensionHost] Extension "${ext.name}" threw during setup() — degrading to core UI:`, err);
    return { ok: false, error: err };
  }
}
