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
    apiKey: row.apiKey ?? undefined,
    email: row.email,
    emailVerified: row.emailVerified,
    displayName: row.displayName ?? undefined,
    photoUrl: row.photoUrl ?? undefined,
    bio: row.bio ?? undefined,
    coverImage: row.coverImage ?? undefined,
    dateOfBirth: row.dateOfBirth ?? undefined,
    episCloudTenantId: row.episCloudTenantId ?? undefined,
    episCloudActivatedAt: row.episCloudActivatedAt ?? undefined,
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
  apiKey?: string
}) {
  const now = new Date()
  return {
    now,
    values: {
      id: crypto.randomUUID(),
      providerUid: profile.providerUid,
      password: null,
      apiKey: profile.apiKey,
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
            apiKey: null,
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
        provider,
        apiKey: profile.apiKey
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
            apiKey: profile.apiKey,
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

  async clearApiKey(id: string): Promise<void> {
    await getDb()
      .update(users)
      .set({ apiKey: null, updatedAt: new Date() })
      .where(eq(users.id, id))
  }

  async updateProfile(
    id: string,
    fields: {
      displayName: string | null
      bio: string | null
      photoUrl: string | null
      coverImage: string | null
      dateOfBirth: string | null
    }
  ): Promise<AuthUser> {
    const [row] = await getDb()
      .update(users)
      .set({
        displayName: fields.displayName,
        bio: fields.bio,
        photoUrl: fields.photoUrl,
        coverImage: fields.coverImage,
        dateOfBirth: fields.dateOfBirth,
        updatedAt: new Date()
      })
      .where(eq(users.id, id))
      .returning()
    if (!row) throw new AuthError('unauthorized')
    return rowToAuthUser(row)
  }

  async activateEpisCloud(id: string, tenantId: string): Promise<AuthUser> {
    const [row] = await getDb()
      .update(users)
      .set({ episCloudTenantId: tenantId, episCloudActivatedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning()
    if (!row) throw new AuthError('unauthorized')
    return rowToAuthUser(row)
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
    bio: user.bio,
    coverImage: user.coverImage,
    dateOfBirth: user.dateOfBirth,
    episCloudTenantId: user.episCloudTenantId,
    episCloudActivatedAt: user.episCloudActivatedAt,
    provider: user.provider
  }
}
