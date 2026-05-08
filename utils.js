// Pure utility functions — imported via importScripts in background.js and via require() in tests.

function buildGmailQuery(filters) {
  const parts = [];
  if (filters.from) parts.push(`from:${filters.from}`);
  if (filters.subject) parts.push(`subject:(${filters.subject})`);
  if (filters.dateFrom) parts.push(`after:${formatDateForGmail(filters.dateFrom)}`);
  if (filters.dateTo) parts.push(`before:${formatDateForGmail(filters.dateTo)}`);
  return parts.join(' ');
}

function formatDateForGmail(dateStr) {
  // Gmail search expects YYYY/MM/DD, inputs arrive as YYYY-MM-DD
  return dateStr.replace(/-/g, '/');
}

function parseEmailHeader(headers, name) {
  if (!headers || !Array.isArray(headers)) return '';
  const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
  return header ? header.value : '';
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.getFullYear() === now.getFullYear()) {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatSender(from) {
  if (!from) return '(unknown sender)';
  const match = from.match(/^"?([^"<]+)"?\s*<?[^>]*>?$/);
  return match ? match[1].trim() : from;
}

// CommonJS export for Jest tests; not executed in service worker (module is undefined there)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { buildGmailQuery, formatDateForGmail, parseEmailHeader, formatDisplayDate, formatSender };
}
