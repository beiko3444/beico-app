import { createRemoteJWKSet, jwtVerify } from 'jose'

const GITHUB_ACTIONS_ISSUER = 'https://token.actions.githubusercontent.com'
const GITHUB_ACTIONS_AUDIENCE = 'beiko-worm-customs-monitor'
const GITHUB_REPOSITORY = 'beiko3444/beico-app'
const GITHUB_MAIN_REF = 'refs/heads/main'
const githubActionsJwks = createRemoteJWKSet(new URL(`${GITHUB_ACTIONS_ISSUER}/.well-known/jwks`))

export async function isAuthorizedGithubActionsOidc(token: string) {
  if (!token) return false

  try {
    const { payload } = await jwtVerify(token, githubActionsJwks, {
      issuer: GITHUB_ACTIONS_ISSUER,
      audience: GITHUB_ACTIONS_AUDIENCE,
    })
    const eventName = typeof payload.event_name === 'string' ? payload.event_name : ''

    return payload.repository === GITHUB_REPOSITORY
      && payload.ref === GITHUB_MAIN_REF
      && (eventName === 'schedule' || eventName === 'workflow_dispatch')
  } catch (error) {
    console.warn('[github-actions-oidc] token verification failed', error)
    return false
  }
}
