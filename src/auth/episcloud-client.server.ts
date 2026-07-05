import '@tanstack/react-start/server-only'
import axios from 'axios'
import { AuthError } from './auth-errors'
import { getEpisCloudBaseUrl, getEpisCloudPartnerToken } from './episcloud-config'

type EpisCloudAccount = {
  tenant_id: string
  slug: string
  display_name: string
  status: string
  created_at: number
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
      throw new AuthError('episcloud-activation-failed')
    }
  }
}
