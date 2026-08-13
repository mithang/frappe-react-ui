// Resolves a "Custom" Dashboard Chart's data source.
//
// Custom charts are the one chart_type that CANNOT go through
// frappe.desk.doctype.dashboard_chart.dashboard_chart.get: that endpoint unconditionally appends
// a `[chart.document_type, "docstatus", "<", 2]` filter (dashboard_chart.py), and a Custom chart
// has no document_type — so the server builds a query against DocType "" and throws
// "DocType  not found" (verified live against this bench).
//
// Desk instead resolves the chart's `source` (a "Dashboard Chart Source" record) into a
// whitelisted Python method and calls that — chart_widget.js#get_settings:
//
//     frappe.xcall("...dashboard_chart_source.get_config", { name: source })
//       .then(config => { frappe.dom.eval(config); settings = frappe.dashboards.chart_sources[source] })
//
// `get_config` returns raw JavaScript, not JSON, so it has to be executed to read the `method`
// off it. That is done here in a scope containing only a minimal `frappe` stub — the script is a
// small declaration written by the app author (same trust boundary as Client Scripts and
// depends_on, which this codebase already evaluates), not user input.

import { getFrappeClient } from '@/lib/api/client';
import { getDefaultCompanyDefaults } from '@/lib/frappe/dynamicFilters';

export interface ChartSourceSettings {
  /** Dotted path of the whitelisted method that returns { labels, datasets }. */
  method: string;
  /** Filter definitions declared by the source. Defaults are intentionally left unresolved —
   *  see resolveChartSourceSettings. */
  filters?: unknown[];
}

/** Builds the `frappe` surface these config scripts touch, and captures what they register. */
function buildStubScope(defaultCompany?: string | null): { frappe: Record<string, unknown>; sources: Record<string, ChartSourceSettings> } {
  const sources: Record<string, ChartSourceSettings> = {};

  const frappe: Record<string, unknown> = {
    dashboards: { chart_sources: sources },
    // Real frappe.provide creates the nested namespace; ours already exists, so this only has to
    // not throw.
    provide: () => undefined,
    // Filter defaults commonly call this (e.g. default company). Deliberately returns undefined:
    // the chart source's own Python falls back to frappe.defaults.get_defaults() server-side when
    // a filter is absent, which is both more correct and avoids needing user defaults client-side.
    defaults: {
      get_user_default: (key?: string) =>
        typeof key === 'string' && key.toLowerCase() === 'company' ? defaultCompany ?? undefined : undefined,
      get_default: (key?: string) =>
        typeof key === 'string' && key.toLowerCase() === 'company' ? defaultCompany ?? undefined : undefined,
    },
    boot: { sysdefaults: {} },
  };

  return { frappe, sources };
}

/**
 * Stand-in for Frappe's client-side document cache. A self-returning Proxy so that arbitrary
 * chained reads resolve instead of throwing — Account Balance Timeline's config computes a filter
 * default as `locals[":Company"][<company>]["default_bank_account"]`, which blows up on a plain
 * `{}` at the second hop. Only `method` is read off the result, so the placeholder these chains
 * produce never reaches a request.
 */
function buildSafeLocals(companyRow?: { name: string; defaults: Record<string, unknown> }): unknown {
  const handler: ProxyHandler<Record<string, unknown>> = {
    get: (): unknown => new Proxy({}, handler),
  };

  if (!companyRow) return new Proxy({}, handler);

  // Populate the one cache entry these configs actually read, so a filter default like
  // locals[":Company"][company]["default_bank_account"] resolves to the REAL account instead of a
  // placeholder. Account Balance Timeline's `account` filter is reqd, and the server rejects the
  // call outright ("Account filter not set!") when it's missing.
  const companies: Record<string, unknown> = { [companyRow.name]: companyRow.defaults };
  return new Proxy(
    { ':Company': companies },
    {
      get: (target, prop: string) => (prop in target ? target[prop as ':Company'] : new Proxy({}, handler)),
    }
  );
}

/** Last-resort extraction when the config can't be executed at all — the method is a plain string
 *  literal in every Frappe-authored source, so this stays useful without pretending to be a parser. */
function extractMethodByPattern(script: string): string | null {
  return script.match(/method\s*:\s*["']([^"']+)["']/)?.[1] ?? null;
}

/** Executes a Dashboard Chart Source config script and returns what it registered. */
export function evaluateChartSourceScript(
  script: string,
  sourceName: string,
  companyRow?: { name: string; defaults: Record<string, unknown> }
): ChartSourceSettings | null {
  const { frappe, sources } = buildStubScope(companyRow?.name);

  try {
    // `__` is Frappe's translation helper and `locals` its client-side doc cache; both appear
    // inside these configs.
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const fn = new Function('frappe', '__', 'locals', script);
    fn(frappe, (s: string) => s, buildSafeLocals(companyRow));
  } catch (error) {
    const method = extractMethodByPattern(script);
    if (method) {
      console.warn(`[chartSource] Config for "${sourceName}" failed to execute; using its declared method.`, error);
      return { method };
    }
    console.error(`[chartSource] Failed to evaluate config for "${sourceName}":`, error);
    return null;
  }

  const settings = sources[sourceName];
  if (settings?.method) return settings;

  const method = extractMethodByPattern(script);
  if (method) return { method };

  console.error(`[chartSource] Config for "${sourceName}" registered no method.`);
  return null;
}

/**
 * De-duplicates identical in-flight requests.
 *
 * Chart source methods are wrapped in @cache_source, which WRITES its cache while serving a read.
 * Two identical calls landing together therefore contend on the same rows and the second comes
 * back 508 QueryDeadlockError — reproduced here, because React's StrictMode double-invokes the
 * effect in dev and fires every chart request twice. Sharing one promise per (method, args) also
 * halves the traffic when two widgets show the same chart.
 */
const inFlight = new Map<string, Promise<unknown>>();

function dedupe<T>(key: string, run: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = run().finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise as Promise<T>;
}

/** Calls a chart source's whitelisted method, collapsing duplicate concurrent requests. */
export function fetchChartSourceData<T>(method: string, args: Record<string, unknown>): Promise<T> {
  return dedupe(`${method}|${JSON.stringify(args)}`, () => getFrappeClient().call<T>(method, args));
}

export async function resolveChartSourceSettings(sourceName: string): Promise<ChartSourceSettings | null> {
  if (!sourceName) return null;

  const script = await dedupe(`config|${sourceName}`, () =>
    getFrappeClient().call<string>(
      'frappe.desk.doctype.dashboard_chart_source.dashboard_chart_source.get_config',
      { name: sourceName }
    )
  );
  if (!script) return null;

  const companyRow = await getDefaultCompanyDefaults();
  return evaluateChartSourceScript(script, sourceName, companyRow ?? undefined);
}
