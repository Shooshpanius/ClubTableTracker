export function getAttachmentDisplayName(url: string, fallback: string): string {
  try {
    const parsed = new URL(url, window.location.origin)
    const nameFromQuery = parsed.searchParams.get('name')
    if (nameFromQuery && nameFromQuery.trim()) return nameFromQuery
    const fromPath = decodeURIComponent(parsed.pathname.split('/').pop() ?? '')
    return fromPath || fallback
  } catch {
    return fallback
  }
}
