const {
  buildGmailQuery,
  formatDateForGmail,
  parseEmailHeader,
  formatDisplayDate,
  formatSender,
} = require('../utils');

// ── buildGmailQuery ───────────────────────────────────────────────────────────

describe('buildGmailQuery', () => {
  test('returns empty string for empty filters', () => {
    expect(buildGmailQuery({})).toBe('');
  });

  test('builds from: clause', () => {
    expect(buildGmailQuery({ from: 'test@example.com' })).toBe('from:test@example.com');
  });

  test('builds subject: clause with parentheses', () => {
    expect(buildGmailQuery({ subject: 'newsletter' })).toBe('subject:(newsletter)');
  });

  test('builds subject: with spaces preserved inside parens', () => {
    expect(buildGmailQuery({ subject: 'hello world' })).toBe('subject:(hello world)');
  });

  test('builds after: clause from dateFrom', () => {
    expect(buildGmailQuery({ dateFrom: '2024-01-01' })).toBe('after:2024/01/01');
  });

  test('builds before: clause from dateTo', () => {
    expect(buildGmailQuery({ dateTo: '2024-12-31' })).toBe('before:2024/12/31');
  });

  test('builds full date range', () => {
    const q = buildGmailQuery({ dateFrom: '2024-01-01', dateTo: '2024-12-31' });
    expect(q).toBe('after:2024/01/01 before:2024/12/31');
  });

  test('combines all filter types', () => {
    const q = buildGmailQuery({
      from: 'spam@test.com',
      subject: 'promo',
      dateFrom: '2024-01-01',
      dateTo: '2024-06-30',
    });
    expect(q).toBe('from:spam@test.com subject:(promo) after:2024/01/01 before:2024/06/30');
  });

  test('ignores undefined/empty fields', () => {
    expect(buildGmailQuery({ from: '', subject: undefined })).toBe('');
  });

  test('labelId is not included in the query string', () => {
    const q = buildGmailQuery({ labelId: 'INBOX', from: 'x@y.com' });
    expect(q).toBe('from:x@y.com');
    expect(q).not.toContain('INBOX');
  });
});

// ── formatDateForGmail ────────────────────────────────────────────────────────

describe('formatDateForGmail', () => {
  test('converts YYYY-MM-DD to YYYY/MM/DD', () => {
    expect(formatDateForGmail('2024-01-15')).toBe('2024/01/15');
  });

  test('converts end-of-year date', () => {
    expect(formatDateForGmail('2024-12-31')).toBe('2024/12/31');
  });

  test('converts single-digit month and day', () => {
    expect(formatDateForGmail('2024-03-05')).toBe('2024/03/05');
  });
});

// ── parseEmailHeader ──────────────────────────────────────────────────────────

describe('parseEmailHeader', () => {
  const headers = [
    { name: 'From',    value: 'Alice <alice@example.com>' },
    { name: 'Subject', value: 'Hello World' },
    { name: 'Date',    value: 'Thu, 1 Jan 2024 00:00:00 +0000' },
  ];

  test('finds header by exact name', () => {
    expect(parseEmailHeader(headers, 'Subject')).toBe('Hello World');
  });

  test('is case-insensitive', () => {
    expect(parseEmailHeader(headers, 'from')).toBe('Alice <alice@example.com>');
    expect(parseEmailHeader(headers, 'FROM')).toBe('Alice <alice@example.com>');
  });

  test('returns empty string for missing header', () => {
    expect(parseEmailHeader(headers, 'CC')).toBe('');
  });

  test('returns empty string for null headers', () => {
    expect(parseEmailHeader(null, 'From')).toBe('');
  });

  test('returns empty string for undefined headers', () => {
    expect(parseEmailHeader(undefined, 'From')).toBe('');
  });

  test('returns empty string for non-array input', () => {
    expect(parseEmailHeader({}, 'From')).toBe('');
  });
});

// ── formatSender ──────────────────────────────────────────────────────────────

describe('formatSender', () => {
  test('extracts display name from "Name <email>" format', () => {
    expect(formatSender('Alice Smith <alice@example.com>')).toBe('Alice Smith');
  });

  test('extracts display name from quoted format', () => {
    expect(formatSender('"Bob Jones" <bob@example.com>')).toBe('Bob Jones');
  });

  test('returns raw value if no angle brackets', () => {
    expect(formatSender('noreply@example.com')).toBe('noreply@example.com');
  });

  test('returns fallback for empty string', () => {
    expect(formatSender('')).toBe('(unknown sender)');
  });

  test('returns fallback for null', () => {
    expect(formatSender(null)).toBe('(unknown sender)');
  });
});

// ── formatDisplayDate ─────────────────────────────────────────────────────────

describe('formatDisplayDate', () => {
  test('returns empty string for falsy input', () => {
    expect(formatDisplayDate('')).toBe('');
    expect(formatDisplayDate(null)).toBe('');
    expect(formatDisplayDate(undefined)).toBe('');
  });

  test('returns a non-empty string for a valid date', () => {
    const result = formatDisplayDate('Thu, 01 Jan 2015 00:00:00 +0000');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  test('includes year for past years', () => {
    const result = formatDisplayDate('Mon, 15 Mar 2010 12:00:00 +0000');
    expect(result).toContain('2010');
  });
});
