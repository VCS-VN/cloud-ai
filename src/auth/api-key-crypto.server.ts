import '@tanstack/react-start/server-only'
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto'
import { AuthError } from './auth-errors'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12

function getEncryptionKey() {
  const secret = process.env.USER_API_KEY_ENCRYPTION_KEY


  if (!secret) throw new AuthError('auth-config-error')

  // if (secret.startsWith('base64:')) {
  //   const key = Buffer.from(secret.slice('base64:'.length), 'base64')
  //   if (key.length === 32) return key
  // }

  // if (secret.startsWith('hex:')) {
  //   const key = Buffer.from(secret.slice('hex:'.length), 'hex')
  //   if (key.length === 32) return key
  // }

  if (secret.length >= 32) return createHash('sha256').update(secret).digest()

  throw new AuthError('auth-config-error')
}

export function encryptUserApiKey(apiKey: string) {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `v1:${iv.toString('base64url')}:${authTag.toString('base64url')}:${encrypted.toString('base64url')}`
}

export function decryptUserApiKey(encryptedApiKey: string) {
  const [version, ivValue, authTagValue, encryptedValue] = encryptedApiKey.split(':')
  if (version !== 'v1' || !ivValue || !authTagValue || !encryptedValue) throw new AuthError('auth-config-error')

  const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), Buffer.from(ivValue, 'base64url'))
  decipher.setAuthTag(Buffer.from(authTagValue, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final()
  ]).toString('utf8')
}
