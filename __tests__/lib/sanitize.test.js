import { escapeHtml } from '@/lib/sanitize'

describe('escapeHtml', () => {
  it('returns empty string for null, undefined, or empty string', () => {
    expect(escapeHtml('')).toBe('')
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
  })

  it('escapes &, <, >, ", and \' characters', () => {
    const input = '<script>alert("XSS & \'attack\'")</script>'
    const expected = '&lt;script&gt;alert(&quot;XSS &amp; &#39;attack&#39;&quot;)&lt;/script&gt;'
    expect(escapeHtml(input)).toBe(expected)
  })

  it('leaves safe strings unchanged', () => {
    const input = 'Hello World 123 - safe text!'
    expect(escapeHtml(input)).toBe(input)
  })

  it('converts numbers or other types to string safely', () => {
    expect(escapeHtml(12345)).toBe('12345')
  })
})
