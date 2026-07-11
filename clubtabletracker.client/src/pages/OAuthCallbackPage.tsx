import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { oauthRedirectUri, verifyOAuthState, type OAuthProvider } from '../oauthConfig'

interface Props {
  provider: OAuthProvider
}

interface AuthResponse {
  token: string
  user: { id: string; email: string; name: string; displayName?: string }
}

const providerTitle = (provider: OAuthProvider) =>
  provider === 'yandex' ? 'Яндекс' : 'ВКонтакте'

/**
 * Landing page for the OAuth redirect: the provider sends the user back here
 * with `?code=...&state=...`. We verify state (CSRF), exchange the code at the
 * backend, store the JWT, then return to the home page.
 */
export default function OAuthCallbackPage({ provider }: Props) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function run() {
      const code = searchParams.get('code')
      const state = searchParams.get('state')
      const providerError = searchParams.get('error')

      if (providerError) {
        const desc = searchParams.get('error_description') ?? providerError
        if (!cancelled) setError(`Провайдер отклонил вход: ${desc}`)
        return
      }

      if (!code) {
        if (!cancelled) setError('Не получен код авторизации.')
        return
      }

      if (!verifyOAuthState(provider, state)) {
        if (!cancelled)
          setError(
            'Несовпадение параметра state (возможна атака CSRF). Повторите вход.',
          )
        return
      }

      try {
        const resp = await fetch(`/api/auth/${provider}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            redirectUri: oauthRedirectUri(provider),
          }),
        })

        if (!resp.ok) {
          const text = await resp.text()
          if (!cancelled) setError(`Ошибка входа (${resp.status}): ${text}`)
          return
        }

        const data = (await resp.json()) as AuthResponse
        localStorage.setItem('token', data.token)
        if (!cancelled) navigate('/', { replace: true })
      } catch (e) {
        if (!cancelled)
          setError(`Сетевая ошибка: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [provider, searchParams, navigate])

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1a1a2e',
        color: '#eee',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 460, padding: 24 }}>
        {error ? (
          <>
            <h2 style={{ color: '#e94560' }}>Не удалось войти</h2>
            <p style={{ color: '#eee', marginTop: 12, wordBreak: 'break-word' }}>
              {error}
            </p>
            <button
              onClick={() => navigate('/', { replace: true })}
              style={{
                marginTop: 20,
                padding: '10px 20px',
                borderRadius: 8,
                border: 'none',
                background: '#0f3460',
                color: '#eee',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              На главную
            </button>
          </>
        ) : (
          <>
            <h2>Вход через {providerTitle(provider)}…</h2>
            <p style={{ color: '#aaa' }}>Подождите, выполняем вход.</p>
          </>
        )}
      </div>
    </div>
  )
}
