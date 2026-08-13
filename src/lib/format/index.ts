// Barrel for src/lib/format. `useSystemSettings` deliberately lives in src/lib/query/queries.ts
// (alongside useSession/useMeta/etc.) and is NOT re-exported here.

export { formatDate } from './formatDate';
export { formatNumber, type FormatNumberOptions } from './formatNumber';
export { formatCurrency, type FormatCurrencyOptions } from './formatCurrency';
export {
  getCachedSystemSettings,
  fetchSystemSettings,
  DEFAULT_SYSTEM_SETTINGS,
  type SystemSettings,
} from './settings';
