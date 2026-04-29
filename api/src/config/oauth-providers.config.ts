/**
 * OAuth provider configuration for "Sign in with Google" and
 * "Sign in with Microsoft" flows.
 *
 * Credentials come from environment variables. When unset, the provider is
 * treated as not configured (the corresponding /start endpoint will 404 / 500
 * gracefully). This keeps the code path shippable without forcing every
 * deployment to configure both providers.
 */

export type OAuthProviderName = 'google' | 'microsoft'

export interface OAuthProviderConfig {
  name: OAuthProviderName
  clientId: string
  clientSecret: string
  authorizeUrl: string
  tokenUrl: string
  userinfoUrl: string
  scopes: string[]
}

export function getOAuthProvider(name: OAuthProviderName): OAuthProviderConfig | null {
  if (name === 'google') {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
    if (!clientId || !clientSecret) return null
    return {
      name: 'google',
      clientId,
      clientSecret,
      authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      userinfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
      scopes: ['openid', 'email', 'profile'],
    }
  }
  if (name === 'microsoft') {
    const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID
    const clientSecret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET
    if (!clientId || !clientSecret) return null
    return {
      name: 'microsoft',
      clientId,
      clientSecret,
      authorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      userinfoUrl: 'https://graph.microsoft.com/oidc/userinfo',
      scopes: ['openid', 'email', 'profile', 'User.Read'],
    }
  }
  return null
}

export function getCallbackUrl(provider: OAuthProviderName | string): string {
  const base = process.env.PUBLIC_API_URL || 'http://localhost:3000'
  return `${base}/api/auth/oauth/${provider}/callback`
}
