/**
 * Escape HTML special characters to prevent injection in email templates.
 *
 * @param {string} str  Untrusted string (e.g. username, wheel name)
 * @returns {string}    HTML-safe string
 */
export function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
