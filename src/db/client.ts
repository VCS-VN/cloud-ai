import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

export function getDatabaseUrl(env: NodeJS.ProcessEnv = process.env) {
  return env.DATABASE_URL ?? 'postgres://user:password@localhost:5432/cloud_ai'
}

let database: PostgresJsDatabase<typeof schema> | undefined
let sqlClient: postgres.Sql | undefined

export function getDb() {
  if (!database) {
    sqlClient = postgres(getDatabaseUrl(), { prepare: false })
    database = drizzle(sqlClient, { schema })
  }
  return database
}

export async function closeDb() {
  await sqlClient?.end()
  sqlClient = undefined
  database = undefined
}
