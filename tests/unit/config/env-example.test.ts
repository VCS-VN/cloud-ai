import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('.env.example', () => {
  it('documents required environment variables', () => { const env = readFileSync('.env.example', 'utf8'); for (const key of ['DATABASE_URL', 'AI_PROVIDER', 'AI_MODEL', 'AI_API_KEY']) expect(env).toContain(key) })
})
