import { beforeEach, describe, expect, it } from 'vitest'
import { applyTheme, resolveTheme } from './theme'

describe('theme', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.classList.remove('cb')
  })

  it('applyTheme sets data-theme and toggles .cb', () => {
    applyTheme('dark', true)
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(document.documentElement.classList.contains('cb')).toBe(true)

    applyTheme('light', false)
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(document.documentElement.classList.contains('cb')).toBe(false)
  })

  it('resolveTheme returns explicit modes verbatim', () => {
    expect(resolveTheme('light')).toBe('light')
    expect(resolveTheme('dark')).toBe('dark')
  })

  it('resolveTheme resolves system to a concrete value', () => {
    expect(['light', 'dark']).toContain(resolveTheme('system'))
  })
})
