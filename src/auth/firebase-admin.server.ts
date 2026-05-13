import '@tanstack/react-start/server-only'
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth'
import { AuthError } from './auth-errors'
import type { FirebaseUserProfile } from './types'

function normalizePrivateKey(value: string) {
  return value.replace(/\\n/g, '\n')
}

function getFirebaseAdminApp(): App {
  const existing = getApps()[0]
  if (existing) return existing

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY

  try {
    if (projectId && clientEmail && privateKey) {
      return initializeApp({
        credential: cert({ projectId, clientEmail, privateKey: normalizePrivateKey(privateKey) })
      })
    }

    if (projectId) return initializeApp({ projectId })
    return initializeApp()
  } catch {
    throw new AuthError('auth-config-error')
  }
}

export async function verifyIdToken(idToken: string) {
  if (!idToken || typeof idToken !== 'string') throw new AuthError('missing-token')
  try {
    const checkRevoked = process.env.FIREBASE_CHECK_REVOKED === 'true'
    return await getAuth(getFirebaseAdminApp()).verifyIdToken(idToken, checkRevoked)
  } catch {
    throw new AuthError('invalid-token')
  }
}

export function mapDecodedTokenToUserProfile(decodedToken: DecodedIdToken): FirebaseUserProfile {
  const email = decodedToken.email
  const emailVerified = decodedToken.email_verified === true
  if (!email || !emailVerified) throw new AuthError('email-not-verified')

  return {
    providerUid: decodedToken.uid,
    password: null,
    email,
    emailVerified,
    displayName: typeof decodedToken.name === 'string' ? decodedToken.name : undefined,
    photoUrl: typeof decodedToken.picture === 'string' ? decodedToken.picture : undefined,
    provider: 'GOOGLE'
  }
}
