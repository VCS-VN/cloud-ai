import { eq } from 'drizzle-orm'
import { getDb } from '@/db/client'
import { users } from '@/db/schema'
import { AuthError } from './auth-errors'
import type { AuthUser, AuthUserSummary, FirebaseUserProfile, OAuthUserProfile } from './types'

function rowToAuthUser(row: typeof users.$inferSelect): AuthUser {
  return {
    id: row.id,
    providerUid: row.providerUid,
    password: row.password,
    email: row.email,
    emailVerified: row.emailVerified,
    displayName: row.displayName ?? undefined,
    photoUrl: row.photoUrl ?? undefined,
    provider: row.provider === 'GITHUB' ? 'GITHUB' : row.provider === 'MONMI_OAUTH' ? 'MONMI_OAUTH' : 'GOOGLE',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastLoginAt: row.lastLoginAt ?? row.updatedAt ?? row.createdAt
  }
}

function mapUpsertValues(profile: {
  providerUid: string
  email: string
  emailVerified: boolean
  displayName?: string
  photoUrl?: string
  provider: AuthUser['provider']
}) {
  const now = new Date()
  return {
    now,
    values: {
      id: crypto.randomUUID(),
      providerUid: profile.providerUid,
      password: null,
      email: profile.email,
      emailVerified: profile.emailVerified,
      displayName: profile.displayName,
      photoUrl: profile.photoUrl,
      provider: profile.provider,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now
    }
  }
}

export class UserRepository {
  async upsertFromFirebase(profile: FirebaseUserProfile): Promise<AuthUser> {
    if (!profile.emailVerified) throw new AuthError('email-not-verified')

    try {
      const { now, values } = mapUpsertValues(profile)
      const [row] = await getDb()
        .insert(users)
        .values(values)
        .onConflictDoUpdate({
          target: users.email,
          set: {
            providerUid: profile.providerUid,
            email: profile.email,
            emailVerified: profile.emailVerified,
            displayName: profile.displayName,
            photoUrl: profile.photoUrl,
            provider: profile.provider,
            updatedAt: now,
            lastLoginAt: now
          }
        })
        .returning()
      return rowToAuthUser(row)
    } catch {
      throw new AuthError('user-upsert-failed')
    }
  }

  async upsertFromOAuth(profile: OAuthUserProfile): Promise<AuthUser> {
    try {
      const emailVerified = profile.emailVerified ?? true
      const provider = profile.provider ?? 'MONMI_OAUTH'
      const { now, values } = mapUpsertValues({
        providerUid: profile.providerUid,
        email: profile.email,
        emailVerified,
        displayName: profile.displayName,
        photoUrl: profile.photoUrl,
        provider
      })

      const [row] = await getDb()
        .insert(users)
        .values(values)
        .onConflictDoUpdate({
          target: users.email,
          set: {
            providerUid: profile.providerUid,
            email: profile.email,
            emailVerified,
            displayName: profile.displayName,
            photoUrl: profile.photoUrl,
            provider,
            updatedAt: now,
            lastLoginAt: now
          }
        })
        .returning()
      return rowToAuthUser(row)
    } catch {
      throw new AuthError('user-upsert-failed')
    }
  }

  async findById(id: string): Promise<AuthUser | null> {
    const [row] = await getDb().select().from(users).where(eq(users.id, id)).limit(1)
    return row ? rowToAuthUser(row) : null
  }
}

export function toAuthUserSummary(user: AuthUser): AuthUserSummary {
  if (!user.emailVerified) throw new AuthError('email-not-verified')
  return {
    id: user.id,
    email: user.email,
    emailVerified: true as const,
    displayName: user.displayName,
    photoUrl: user.photoUrl,
    provider: user.provider
  }
}
