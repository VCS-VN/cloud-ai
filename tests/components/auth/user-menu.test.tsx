import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('UserMenu logout behavior', () => {
  const source = readFileSync('src/components/auth/UserMenu.tsx', 'utf8')

  it('keeps local Cloud AI logout without Firebase client sign-out', () => {
    expect(source).toContain('const result = await logoutFn()')
    expect(source).toContain('await navigate({ to: result.redirectTo })')
    expect(source).not.toContain('signOutFirebaseClient')
  })
})
