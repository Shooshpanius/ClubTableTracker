export function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return true
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64).split('').map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
    )
    const payload: { exp?: number } = JSON.parse(jsonPayload)
    return payload.exp ? payload.exp * 1000 < Date.now() : false
  } catch {
    return true
  }
}
