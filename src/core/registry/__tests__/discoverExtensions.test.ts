import { describe, it, expect, vi } from 'vitest';
import { defineExtension } from '@/sdk';
import { discoverAndInstallExtensions } from '../discoverExtensions';

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as unknown as Response;
}

function notFoundResponse(): Response {
  return {
    ok: false,
    status: 404,
    json: async () => {
      throw new Error('should not be parsed');
    },
  } as unknown as Response;
}

describe('discoverAndInstallExtensions (A9 replacement — no SPA rebuild loading)', () => {
  it('skips an app with no manifest (404) without throwing, and records a reason', async () => {
    const fetchFn = vi.fn().mockResolvedValue(notFoundResponse());
    const importFn = vi.fn();

    const result = await discoverAndInstallExtensions({
      apps: ['no_ui_app'],
      fetchFn,
      importFn,
    });

    expect(result.installed).toEqual([]);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].app).toBe('no_ui_app');
    expect(result.skipped[0].reason).toBeTruthy();
    expect(importFn).not.toHaveBeenCalled();
    expect(fetchFn).toHaveBeenCalledWith(
      expect.stringContaining('/assets/no_ui_app/ui/extension.manifest.json'),
      expect.anything()
    );
  });

  it('installs an app that has a valid manifest and a valid extension module', async () => {
    const setupSpy = vi.fn();
    const validExtension = defineExtension({
      name: 'good-app',
      apiVersion: '1.0',
      setup: setupSpy,
    });

    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ entry: '/assets/good_app/ui/extension.js' }));
    const importFn = vi.fn().mockResolvedValue({ default: validExtension });

    const result = await discoverAndInstallExtensions({
      apps: ['good_app'],
      fetchFn,
      importFn,
    });

    expect(result.skipped).toEqual([]);
    expect(result.installed).toEqual(['good_app']);
    expect(importFn).toHaveBeenCalledWith(expect.stringContaining('/assets/good_app/ui/extension.js'));
    expect(setupSpy).toHaveBeenCalled();
  });

  it("one app's failure never blocks another app's valid extension from installing", async () => {
    const setupSpy = vi.fn();
    const validExtension = defineExtension({
      name: 'good-app',
      apiVersion: '1.0',
      setup: setupSpy,
    });

    const fetchFn = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('broken_app')) {
        throw new Error('network error fetching manifest');
      }
      if (url.includes('good_app')) {
        return jsonResponse({ entry: '/assets/good_app/ui/extension.js' });
      }
      return notFoundResponse();
    });

    const importFn = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('good_app')) {
        return { default: validExtension };
      }
      throw new Error('should not import broken_app');
    });

    const result = await discoverAndInstallExtensions({
      apps: ['broken_app', 'good_app'],
      fetchFn,
      importFn,
    });

    expect(result.installed).toEqual(['good_app']);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].app).toBe('broken_app');
    expect(setupSpy).toHaveBeenCalled();
  });

  it('skips an app whose manifest resolves to a malformed extension module (missing setup)', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ entry: '/assets/malformed_app/ui/extension.js' }));
    const importFn = vi.fn().mockResolvedValue({ default: { name: 'malformed-app' } });

    const result = await discoverAndInstallExtensions({
      apps: ['malformed_app'],
      fetchFn,
      importFn,
    });

    expect(result.installed).toEqual([]);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].app).toBe('malformed_app');
  });

  it('never throws even when nothing is injected and there are no apps', async () => {
    await expect(discoverAndInstallExtensions({ apps: [] })).resolves.toEqual({
      installed: [],
      skipped: [],
    });
  });
});
