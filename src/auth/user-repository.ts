import { eq } from 'drizzle-orm'
import { getDb } from '@/db/client'
import { users } from '@/db/schema'
import { AuthError } from './auth-errors'
import type { AuthUser, FirebaseUserProfile } from './types'

function rowToAuthUser(row: typeof users.$inferSelect): AuthUser {
  return {
    id: row.id,
    firebaseUid: row.firebaseUid,
    email: row.email,
    emailVerified: row.emailVerified,
    displayName: row.displayName ?? undefined,
    photoUrl: row.photoUrl ?? undefined,
    authProvider: row.authProvider === 'google' ? 'google' : 'google',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastLoginAt: row.lastLoginAt ?? row.updatedAt ?? row.createdAt
  }
}

export class UserRepository {
  async upsertFromFirebase(profile: FirebaseUserProfile): Promise<AuthUser> {
    if (!profile.emailVerified) throw new AuthError('email-not-verified')
    const now = new Date()
    const id = crypto.randomUUID()

    try {
      const [row] = await getDb()
        .insert(users)
        .values({
          id,
          firebaseUid: profile.firebaseUid,
          email: profile.email,
          emailVerified: profile.emailVerified,
          displayName: profile.displayName,
          photoUrl: profile.photoUrl,
          authProvider: profile.authProvider,
          createdAt: now,
          updatedAt: now,
          lastLoginAt: now
        })
        .onConflictDoUpdate({
          target: users.firebaseUid,
          set: {
            email: profile.email,
            emailVerified: profile.emailVerified,
            displayName: profile.displayName,
            photoUrl: profile.photoUrl,
            authProvider: profile.authProvider,
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

export function toAuthUserSummary(user: AuthUser) {
  if (!user.emailVerified) throw new AuthError('email-not-verified')
  return {
    id: user.id,
    email: user.email,
    emailVerified: true as const,
    displayName: user.displayName,
    photoUrl: user.photoUrl,
    authProvider: user.authProvider
  }
}
