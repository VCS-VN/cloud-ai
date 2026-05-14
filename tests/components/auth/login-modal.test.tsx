import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('LoginModal OAuth primary path', () => {
  const source = readFileSync('src/components/auth/LoginModal.tsx', 'utf8')

  it('redirects merchant users to Cloud AI OAuth login', () => {
    expect(source).toContain('window.location.href = "/auth/login"')
    expect(source).toContain('Continue with your Monmi account')
  })

  it('does not call Firebase login from merchant login modal', () => {
    expect(source).not.toContain('signInWithGoogleAndGetIdToken')
    expect(source).not.toContain('loginWithFirebaseToken')
    expect(source).not.toContain('mapFirebaseClientError')
  })
})
