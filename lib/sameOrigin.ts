// True when a browser request was sent from a page on this site.
// Browsers always attach Origin to POST/DELETE fetches, so a missing or foreign
// Origin means the request came from another site or a script.
export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin) return false

  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
  try {
    return Boolean(host) && new URL(origin).host === host
  } catch {
    return false
  }
}
