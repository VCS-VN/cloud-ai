import '@tanstack/react-start/server-only'
import axios, { AxiosError } from 'axios'
import { AuthError } from './auth-errors'
import { getEpisCloudBaseUrl, getEpisCloudPartnerToken } from './episcloud-config'

type EpisCloudAccount = {
  tenant_id: string
  slug: string
  display_name: string
  status: string
  created_at: number
}

type EpisCloudErrorEnvelope = {
  error?: { code?: string; message?: string }
}

function logEpisCloudError(event: string, error: unknown) {
  if (error instanceof AxiosError) {
    const data = error.response?.data as EpisCloudErrorEnvelope | undefined
    console.error(JSON.stringify({
      event,
      status: error.response?.status,
      code: data?.error?.code,
      message: data?.error?.message,
      reason: error.message
    }))
    return
  }
  console.error(JSON.stringify({
    event,
    reason: error instanceof Error ? error.message : 'unknown'
  }))
}

export class EpisCloudClient {
  async createAccount(input: { externalRef: string; displayName: string }): Promise<EpisCloudAccount> {
    try {
      const response = await axios.post<EpisCloudAccount>(
        `${getEpisCloudBaseUrl()}/v1/partner/accounts`,
        { external_ref: input.externalRef, display_name: input.displayName },
        { headers: { Authorization: `Bearer ${getEpisCloudPartnerToken()}`, 'Content-Type': 'application/json' } }
      )
      if (!response.data?.tenant_id) throw new AuthError('episcloud-activation-failed')
      return response.data
    } catch (error) {
      if (error instanceof AuthError) throw error
      logEpisCloudError('episcloud_create_account_failed', error)
      throw new AuthError('episcloud-activation-failed')
    }
  }
}
