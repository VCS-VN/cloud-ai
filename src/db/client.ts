export function getDatabaseUrl(env: NodeJS.ProcessEnv = process.env) { return env.DATABASE_URL ?? 'postgres://user:password@localhost:5432/cloud_ai' }
