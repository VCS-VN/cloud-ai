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

  it('maps the OpenAI-compatible /models response to EpisCloudModel[]', async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        object: 'list',
        data: [
          { id: 'gpt-4o', object: 'model', owned_by: 'openai' },
          { id: 'claude-sonnet', object: 'model', owned_by: 'anthropic' }
        ]
      }
    })

    const client = new EpisCloudClient()
    const models = await client.listModels('epis_sk_secret')

    expect(models).toEqual([
      { id: 'gpt-4o', ownedBy: 'openai' },
      { id: 'claude-sonnet', ownedBy: 'anthropic' }
    ])
    // Hits the gateway /models endpoint with the user's key as a bearer token.
    expect(mockedGet).toHaveBeenCalledWith('https://gateway.test/v1/models', {
      headers: { Authorization: 'Bearer epis_sk_secret' }
    })
  })

  it('drops entries without an id', async () => {
    mockedGet.mockResolvedValueOnce({
      data: { data: [{ owned_by: 'openai' }, { id: 'gpt-4o' }] }
    })

    const client = new EpisCloudClient()
    const models = await client.listModels('epis_sk_secret')

    expect(models).toEqual([{ id: 'gpt-4o', ownedBy: undefined }])
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
