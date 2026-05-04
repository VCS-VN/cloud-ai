import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('storefront builder routes', () => {
  it('includes Home and Projects routes in generated route tree output', () => {
    const routeTreeSource = readFileSync('src/routeTree.gen.ts', 'utf8')

    expect(routeTreeSource).toContain("'/'")
    expect(routeTreeSource).toContain("'/projects'")
    expect(routeTreeSource).toContain('ProjectsRoute')
  })
})
