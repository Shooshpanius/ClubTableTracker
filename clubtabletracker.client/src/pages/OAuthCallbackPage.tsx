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
    <div className="gd-app gd-auth-layout">
      <div className="gd-auth-card">
        {error ? (
          <>
            <div style={{ fontSize: '2.5rem', marginBottom: 'var(--gd-s3)', opacity: 0.5 }}>☠</div>
            <p
              className="gd-display"
              style={{ fontSize: '0.85rem', letterSpacing: '0.06em', color: 'var(--gd-danger)' }}
            >
              Вокс-связь потеряна
            </p>
            <div className="gd-error-box gd-mt-4">
              <p
                className="gd-text-sm"
                style={{ wordBreak: 'break-word', color: 'var(--gd-fg)' }}
              >
                {error}
              </p>
            </div>
            <button
              type="button"
              className="gd-btn gd-btn-secondary gd-btn-block gd-mt-4"
              onClick={() => navigate('/login', { replace: true })}
            >
              Вернуться
            </button>
          </>
        ) : (
          <>
            <div className="gd-spinner" style={{ margin: '0 auto var(--gd-s4)' }} />
            <p
              className="gd-display"
              style={{ fontSize: '0.75rem', letterSpacing: '0.06em', color: 'var(--gd-brass)' }}
            >
              Устанавливаем вокс-связь…
            </p>
            <p className="gd-text-xs gd-text-muted gd-mt-2">
              Вход через {providerTitle(provider)}. Ожидайте подтверждения от Когитатора.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
