// Port of Frappe's `frappe.datetime.prettyDate` (frappe/public/js/frappe/utils/pretty_date.js).
// Desk shows relative timestamps ("2 hours ago", "yesterday") in quick lists, timelines and
// comments rather than absolute dates; the exact wording and the bucket boundaries below are
// copied from that file so this reads identically to the rest of a Frappe deployment.

/** Parses Frappe's "YYYY-MM-DD HH:mm:ss(.ffffff)" wire format, which `new Date()` does not
 *  reliably accept across browsers (Safari rejects the space separator). */
function parseFrappeDate(value: string | Date): Date | null {
  if (value instanceof Date) return value;
  if (typeof value !== 'string' || !value) return null;

  const normalized = value.replace(/-/g, '/').replace(/[TZ]/g, ' ').replace(/\.[0-9]*/, '').trim();
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * @param mini Desk's compact form ("3 h", "2 d") used where space is tight; the default long form
 *             ("3 hours ago", "yesterday") is what quick lists use.
 */
export function prettyDate(date: string | Date | undefined | null, mini = false): string {
  if (!date) return '';

  const parsed = parseFrappeDate(date);
  if (!parsed) return '';

  const now = new Date();
  const diff = (now.getTime() - parsed.getTime()) / 1000;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eventDay = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  const dayDiff = Math.floor((today.getTime() - eventDay.getTime()) / 86400000);

  // Future dates and unparseable input render as nothing, exactly as Desk does.
  if (Number.isNaN(dayDiff) || dayDiff < 0) return '';

  if (mini) {
    if (dayDiff === 0) {
      if (diff < 60) return 'now';
      if (diff < 3600) return `${Math.floor(diff / 60)} m`;
      if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
    }
    if (dayDiff < 7) return `${dayDiff} d`;
    if (dayDiff < 31) return `${Math.floor(dayDiff / 7)} w`;
    if (dayDiff < 365) return `${Math.floor(dayDiff / 30)} M`;
    return `${Math.floor(dayDiff / 365)} y`;
  }

  if (dayDiff === 0) {
    if (diff < 60) return 'just now';
    if (diff < 120) return '1 minute ago';
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 7200) return '1 hour ago';
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  }
  if (dayDiff === 1) return 'yesterday';
  if (dayDiff < 7) return `${dayDiff} days ago`;
  if (dayDiff < 14) return '1 week ago';
  if (dayDiff < 31) return `${Math.floor(dayDiff / 7)} weeks ago`;
  if (dayDiff < 62) return '1 month ago';
  if (dayDiff < 365) return `${Math.floor(dayDiff / 30)} months ago`;
  if (dayDiff < 730) return '1 year ago';
  return `${Math.floor(dayDiff / 365)} years ago`;
}
