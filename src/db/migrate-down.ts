import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import postgres from 'postgres'
import { getDatabaseUrl } from './client'

const migrationsDir = new URL('./migrations/', import.meta.url).pathname
const migrationsSchema = 'drizzle'
const migrationsTable = '__drizzle_migrations'

function latestDownMigration() {
  if (!existsSync(migrationsDir)) return undefined
  return readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.down.sql'))
    .sort()
    .at(-1)
}

function migrationPrefix(file: string) {
  return basename(file, '.down.sql')
}

async function main() {
  const downFile = latestDownMigration()
  if (!downFile) {
    console.log('No down migration found in src/db/migrations. Expected a *.down.sql file.')
    return
  }

  const sqlText = readFileSync(join(migrationsDir, downFile), 'utf8').trim()
  if (!sqlText) throw new Error(`Down migration ${downFile} is empty.`)

  const client = postgres(getDatabaseUrl(), { prepare: false })
  const prefix = migrationPrefix(downFile)

  try {
    await client.begin(async (tx) => {
      await tx.unsafe(`create schema if not exists "${migrationsSchema}"`)
      await tx.unsafe(`create table if not exists "${migrationsSchema}"."${migrationsTable}" (
        id serial primary key,
        hash text not null,
        created_at bigint
      )`)
      await tx.unsafe(sqlText)
      await tx.unsafe(
        `delete from "${migrationsSchema}"."${migrationsTable}"
         where id = (
           select id from "${migrationsSchema}"."${migrationsTable}"
           order by created_at desc
           limit 1
         )
         and exists (
           select 1 from "${migrationsSchema}"."${migrationsTable}"
         )`
      )
    })
    console.log(`Rolled back latest migration using ${downFile} (${prefix}).`)
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Migration rollback failed.')
  process.exitCode = 1
})
