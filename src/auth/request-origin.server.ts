import '@tanstack/react-start/server-only'
import { getRequestUrl } from '@tanstack/react-start/server'

export function getCurrentRequestOrigin() {
  return getRequestUrl({ xForwardedHost: true, xForwardedProto: true }).origin
}
