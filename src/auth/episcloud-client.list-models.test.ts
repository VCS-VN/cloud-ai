import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import { EpisCloudClient } from './episcloud-client.server'
import { AuthError } from './auth-errors'

vi.mock('axios')

const mockedGet = vi.mocked(axios.get)

describe('EpisCloudClient.listModels', () => {
  beforeAll(() => {
    process.env.EPISCLOUD_AIGW_BASE_URL = 'https://gateway.test/v1'
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('keeps only the allowed episcloud coder models and derives a display name', async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        object: 'list',
        data: [
          { id: 'gpt-4o', object: 'model', owned_by: 'openai' },
          { id: 'episcloud-ai-coder', object: 'model', owned_by: 'episcloud' },
          { id: 'episcloud-ai-coder-max', object: 'model', owned_by: 'episcloud' }
        ]
      }
    })

    const client = new EpisCloudClient()
    const models = await client.listModels('epis_sk_secret')

    expect(models).toEqual([
      { id: 'episcloud-ai-coder', name: 'AI Coder', ownedBy: 'episcloud' },
      { id: 'episcloud-ai-coder-max', name: 'AI Coder Max', ownedBy: 'episcloud' }
    ])
    // Hits the gateway /models endpoint with the user's key as a bearer token.
    expect(mockedGet).toHaveBeenCalledWith('https://gateway.test/v1/models', {
      headers: { Authorization: 'Bearer epis_sk_secret' }
    })
  })

  it('drops entries without an id and entries outside the allow-list', async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        data: [
          { owned_by: 'episcloud' },
          { id: 'gpt-4o' },
          { id: 'episcloud-ai-coder', owned_by: 'episcloud' }
        ]
      }
    })

    const client = new EpisCloudClient()
    const models = await client.listModels('epis_sk_secret')

    expect(models).toEqual([
      { id: 'episcloud-ai-coder', name: 'AI Coder', ownedBy: 'episcloud' }
    ])
  })

  it('throws episcloud-models-failed when the response shape is invalid', async () => {
    mockedGet.mockResolvedValueOnce({ data: { data: 'not-an-array' } })

    const client = new EpisCloudClient()

    await expect(client.listModels('epis_sk_secret')).rejects.toMatchObject({
      code: 'episcloud-models-failed'
    })
  })

  it('throws episcloud-models-failed when the request rejects', async () => {
    mockedGet.mockRejectedValueOnce(new Error('network down'))

    const client = new EpisCloudClient()

    await expect(client.listModels('epis_sk_secret')).rejects.toBeInstanceOf(AuthError)
  })
})
