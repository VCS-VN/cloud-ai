import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth'
import { AuthError, mapFirebaseClientError } from './auth-errors'

function requireClientConfig() {
  const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || undefined
  }

  if (!config.apiKey || !config.authDomain || !config.projectId || !config.appId) {
    throw new AuthError('auth-config-error')
  }

  return config
}

export function getFirebaseClientApp(): FirebaseApp {
  if (typeof window === 'undefined') throw new AuthError('auth-config-error')
  return getApps()[0] ?? initializeApp(requireClientConfig())
}

export async function signInWithGoogleAndGetIdToken() {
  try {
    const auth = getAuth(getFirebaseClientApp())
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })
    const result = await signInWithPopup(auth, provider)
    const idToken = await result.user.getIdToken()
    return { idToken }
  } catch (error) {
    throw new AuthError(mapFirebaseClientError(error))
  }
}

export async function signOutFirebaseClient() {
  if (typeof window === 'undefined') return
  const auth = getAuth(getFirebaseClientApp())
  await firebaseSignOut(auth)
}
