/**
 * Strips tags and decodes entities from server-generated HTML fragments (workspace header text,
 * Data Import warning messages) without ever rendering the markup — a detached <textarea>
 * decodes entities via the browser's own HTML parser; `.value` is plain decoded text, nothing is
 * inserted into the live DOM. Deliberately not `dangerouslySetInnerHTML` (D5's XSS concern):
 * even where a given source is server-escaped today (verified for Data Import warnings via
 * `escape_html()` in importer.py), that's an assumption about server internals a future Frappe
 * version could silently break without any client-side signal.
 */
export function decodeHtmlText(html: string): string {
  const stripped = html.replace(/<[^>]*>?/gm, '');
  const textarea = document.createElement('textarea');
  textarea.innerHTML = stripped;
  return textarea.value;
}
