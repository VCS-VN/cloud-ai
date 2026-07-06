import { eq } from 'drizzle-orm'
import { getDb } from '@/db/client'
import { userSettings } from '@/db/schema'

export type UserSettings = {
  userId: string
  episCloudApiKey?: string
  episCloudApiKeyId?: string
  episCloudApiKeyPrefix?: string
}

function rowToUserSettings(row: typeof userSettings.$inferSelect): UserSettings {
  return {
    userId: row.userId,
    episCloudApiKey: row.episCloudApiKey ?? undefined,
    episCloudApiKeyId: row.episCloudApiKeyId ?? undefined,
    episCloudApiKeyPrefix: row.episCloudApiKeyPrefix ?? undefined
  }
}

export class UserSettingsRepository {
  async findByUserId(userId: string): Promise<UserSettings | null> {
    const [row] = await getDb()
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1)
    return row ? rowToUserSettings(row) : null
  }

  async saveEpisCloudApiKey(
    userId: string,
    apiKey: { encryptedSecret: string; keyId: string; prefix: string }
  ): Promise<UserSettings> {
    const now = new Date()
    const [row] = await getDb()
      .insert(userSettings)
      .values({
        id: crypto.randomUUID(),
        userId,
        episCloudApiKey: apiKey.encryptedSecret,
        episCloudApiKeyId: apiKey.keyId,
        episCloudApiKeyPrefix: apiKey.prefix,
        createdAt: now,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: {
          episCloudApiKey: apiKey.encryptedSecret,
          episCloudApiKeyId: apiKey.keyId,
          episCloudApiKeyPrefix: apiKey.prefix,
          updatedAt: now
        }
      })
      .returning()
    return rowToUserSettings(row)
  }
}
