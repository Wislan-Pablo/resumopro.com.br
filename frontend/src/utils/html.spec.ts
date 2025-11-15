import { describe, it, expect } from 'vitest'
import { sanitizeHtml } from './html'

describe('sanitizeHtml', () => {
  it('remove scripts e atributos on*', () => {
    const input = '<div onclick="alert(1)"><script>mal()</script><a href="javascript:bad()">x</a></div>'
    const out = sanitizeHtml(input)
    expect(out).not.toContain('script')
    expect(out).not.toContain('onclick')
    expect(out).not.toContain('javascript:')
  })
})
