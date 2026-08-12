import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { isYandexConfigured, isVkConfigured, buildOAuthAuthorizeUrl } from '../oauthConfig'
import { isTokenExpired } from '../utils/auth'
import { Button } from '../components/ui'
import { GothicDivider } from '../components/ui'

/**
 * Full-page authentication screen (Grimdark V4).
 * Implements plans/v4-веб-авторизация.html — login / not-configured states.
 * Loading and error states live in OAuthCallbackPage (the redirect target).
 */
export default function LoginPage() {
  const navigate = useNavigate()

  // If already authenticated, go straight to home.
  useEffect(() => {
    const stored = localStorage.getItem('token')
    if (stored && !isTokenExpired(stored)) {
      navigate('/', { replace: true })
    }
  }, [navigate])

  const startLogin = (provider: 'yandex' | 'vk') => {
    const url = buildOAuthAuthorizeUrl(provider)
    if (url) window.location.href = url
  }

  const yandexOn = isYandexConfigured
  const vkOn = isVkConfigured
  const noneConfigured = !yandexOn && !vkOn

  return (
    <div className="gd-app gd-auth-layout">
      <div className="gd-auth-card">
        {/* ── Branded header ── */}
        <div
          className="gd-display"
          style={{ fontSize: '1.3rem', color: 'var(--gd-brass)', letterSpacing: '0.1em', marginBottom: 'var(--gd-s1)' }}
        >
          CLUB TABLE TRACKER
        </div>
        <div
          className="gd-display"
          style={{ fontSize: '0.7rem', color: 'var(--gd-blood-red)', letterSpacing: '0.15em', marginBottom: 'var(--gd-s4)' }}
        >
          In the grim darkness, there is only war
        </div>
        <GothicDivider />
        <p className="gd-text-secondary" style={{ marginBottom: 'var(--gd-s6)' }}>
          Войдите, чтобы бронировать столы и общаться в вокс-канале
        </p>

        {/* ── Login buttons ── */}
        {!noneConfigured && (
          <div className="gd-provider-list">
            {yandexOn && (
              <Button
                variant="primary"
                block
                className="gd-btn-yandex"
                onClick={() => startLogin('yandex')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <circle cx="12" cy="12" r="12" />
                </svg>
                Войти через Яндекс
              </Button>
            )}
            {vkOn && (
              <Button
                variant="primary"
                block
                className="gd-btn-vk"
                onClick={() => startLogin('vk')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M12.785 16.241s.288-.032.435-.194c.135-.148.131-.426.131-.426s-.019-1.302.581-1.494c.591-.189 1.349 1.272 2.152 1.835.607.425 1.068.332 1.068.332l2.151-.031s1.124-.071.591-.967c-.044-.073-.31-.661-1.598-1.87-1.349-1.273-1.168-1.067.456-3.27.99-1.342 1.387-2.161 1.263-2.511-.118-.334-.846-.246-.846-.246l-2.421.015s-.18-.025-.313.056c-.13.079-.214.265-.214.265s-.383 1.039-.894 1.923c-1.077 1.864-1.508 1.963-1.684 1.847-.411-.27-.308-1.075-.308-1.648 0-1.789.268-2.535-.521-2.729-.262-.064-.455-.107-1.125-.114-.86-.009-1.589.003-2.001.209-.275.137-.486.441-.357.458.159.021.519.099.709.364.246.343.238 1.114.238 1.114s.142 2.116-.331 2.379c-.325.18-.771-.187-1.733-1.884-.491-.864-.862-1.819-.862-1.819s-.071-.179-.199-.275c-.154-.115-.37-.151-.37-.151l-2.301.015s-.345.01-.472.162c-.113.136-.009.416-.009.416s1.801 4.215 3.841 6.339c1.871 1.947 3.995 1.819 3.995 1.819h.961z" />
                </svg>
                Войти через ВКонтакте
              </Button>
            )}
            <p className="gd-text-xs gd-text-muted gd-mt-3" style={{ textAlign: 'center' }}>
              Или привяжите другие аккаунты позже в Когитаторе
            </p>
          </div>
        )}

        {/* ── Not-configured warning ── */}
        {noneConfigured && (
          <div className="gd-warn-box gd-mt-4">
            <p
              className="gd-display"
              style={{ fontSize: '0.75rem', letterSpacing: '0.06em', color: 'var(--gd-warn)' }}
            >
              Провайдеры не настроены
            </p>
            <p className="gd-text-xs gd-mt-2">
              Администратор не задал{' '}
              <code className="gd-mono gd-text-brass" style={{ fontSize: '0.7rem' }}>
                VITE_YANDEX_CLIENT_ID
              </code>
              . Вход временно недоступен.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
