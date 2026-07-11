// OAuth client configuration for Google, Yandex and VK.
//
// Google uses One Tap (ID-token): the client renders the credential itself.
// Yandex and VK use the OAuth 2.0 Authorization Code Flow: the client opens the
// provider's authorize URL, receives a one-time `code` via redirect, then sends
// that code to the backend (/api/auth/yandex|vk). The backend exchanges it for
// an access_token using the client_secret that lives ONLY on the server.
//
// Client IDs come from Vite env vars (see .env.example).

export const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''
export const yandexClientId = import.meta.env.VITE_YANDEX_CLIENT_ID ?? ''
export const vkClientId = import.meta.env.VITE_VK_CLIENT_ID ?? ''

// Placeholder values come from .env.example (e.g. 'your-yandex-client-id').
// Treat empty and placeholder as "not configured" so the UI can hide buttons.
const isPlaceholder = (value: string) =>
  value === '' || value.startsWith('your-')

export const isGoogleConfigured = !isPlaceholder(googleClientId)
export const isYandexConfigured = !isPlaceholder(yandexClientId)
export const isVkConfigured = !isPlaceholder(vkClientId)

export type OAuthProvider = 'yandex' | 'vk'

// window.location.origin doubles as the redirectUri base, so the URI the
// provider redirects to always matches the one registered in its cabinet and
// the one sent to the backend (e.g. https://localhost:5173/auth/yandex/callback
// locally, https://go40k.ru/auth/yandex/callback in production).
const oauthOrigin = typeof window !== 'undefined' ? window.location.origin : ''

export function oauthRedirectUri(provider: OAuthProvider): string {
  return `${oauthOrigin}/auth/${provider}/callback`
}

function randomState(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Builds the provider authorize URL and stashes a random `state` in
 * sessionStorage for CSRF verification in the callback page.
 *
 * NOTE: VK uses the NEW VK ID flow to stay consistent with the backend token
 * exchange endpoint (id.vk.com/oauth2/auth), therefore the authorize base is
 * https://id.vk.com/authorize (NOT the legacy oauth.vk.com).
 *
 * Returns null if the provider is not configured.
 */
export function buildOAuthAuthorizeUrl(provider: OAuthProvider): string | null {
  const clientId = provider === 'yandex' ? yandexClientId : vkClientId
  if (isPlaceholder(clientId)) return null

  const redirectUri = oauthRedirectUri(provider)
  const state = randomState()
  sessionStorage.setItem(`oauth_state_${provider}`, state)

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
  })

  const authorizeBase =
    provider === 'yandex'
      ? 'https://oauth.yandex.ru/authorize'
      : 'https://id.vk.com/authorize'

  return `${authorizeBase}?${params.toString()}`
}

/**
 * Validates the `state` returned by the provider against the value stored when
 * the authorize URL was built, then removes it (single-use). Mitigates CSRF.
 */
export function verifyOAuthState(
  provider: OAuthProvider,
  state: string | null,
): boolean {
  const key = `oauth_state_${provider}`
  const stored = sessionStorage.getItem(key)
  sessionStorage.removeItem(key)
  if (!state || !stored) return false
  return state === stored
}
