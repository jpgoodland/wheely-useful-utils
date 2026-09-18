import { getTrustedBaseUrl } from "./url";

/**
 * OAuth provider configuration and helpers.
 *
 * Supports Google, Microsoft (Entra ID) and GitHub.
 * Client IDs / secrets are read from environment variables so they can be
 * injected via Secrets Manager in production or docker-compose locally.
 */

const PROVIDERS = {
  google: {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userinfoUrl: "https://www.googleapis.com/oauth2/v3/userinfo",
    scopes: "openid email profile",
    clientIdEnv: "OAUTH_GOOGLE_CLIENT_ID",
    clientSecretEnv: "OAUTH_GOOGLE_CLIENT_SECRET",
  },
  microsoft: {
    authorizeUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    userinfoUrl: "https://graph.microsoft.com/v1.0/me",
    scopes: "openid email profile User.Read",
    clientIdEnv: "OAUTH_MICROSOFT_CLIENT_ID",
    clientSecretEnv: "OAUTH_MICROSOFT_CLIENT_SECRET",
  },
  github: {
    authorizeUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    userinfoUrl: "https://api.github.com/user",
    emailsUrl: "https://api.github.com/user/emails",
    scopes: "read:user user:email",
    clientIdEnv: "OAUTH_GITHUB_CLIENT_ID",
    clientSecretEnv: "OAUTH_GITHUB_CLIENT_SECRET",
  },
};

export const SUPPORTED_PROVIDERS = Object.keys(PROVIDERS);

/**
 * Determine the canonical base URL for the application from an incoming Request.
 * Respects reverse proxy headers (x-forwarded-proto, x-forwarded-host, host)
 * and production environment flags (FORCE_HTTPS, NODE_ENV, APP_DOMAIN).
 *
 * @param {Request} [req]
 * @returns {string} e.g. "https://wheel-app.example.com" or "http://localhost:3000"
 */
export function getBaseUrl(req) {
  return getTrustedBaseUrl(req);
}

/**
 * Check if the mock OAuth sandbox is enabled for the provider.
 * Enabled in development mode if no client ID is set, or if client ID is set to a mock value, or if OAUTH_MOCK=true.
 */
export function isMockEnabled(provider) {
  if (process.env.OAUTH_MOCK === "true") {
    return true;
  }
  if (process.env.NODE_ENV === "development") {
    const cfg = PROVIDERS[provider];
    if (cfg) {
      const clientId = process.env[cfg.clientIdEnv] || "";
      const clientSecret = process.env[cfg.clientSecretEnv] || "";
      if (!clientId || !clientSecret || clientId === "mock-client-id" || clientId.startsWith("mock-")) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Return the provider config object, or null if unsupported.
 */
export function getProviderConfig(provider) {
  return PROVIDERS[provider] || null;
}

/**
 * Read client credentials from the environment for a given provider.
 * Returns { clientId, clientSecret } or throws if missing.
 */
export function getClientCredentials(provider) {
  const cfg = PROVIDERS[provider];
  if (!cfg) throw new Error(`Unsupported OAuth provider: ${provider}`);
  const clientId = process.env[cfg.clientIdEnv] || "";
  const clientSecret = process.env[cfg.clientSecretEnv] || "";
  return { clientId, clientSecret };
}

/**
 * Build the full authorization URL the browser should redirect to.
 *
 * @param {string} provider   One of 'google' | 'microsoft' | 'github'
 * @param {string} state      CSRF state token
 * @param {string} redirectUri  Absolute callback URL
 * @returns {string}
 */
export function getAuthUrl(provider, state, redirectUri) {
  const cfg = PROVIDERS[provider];
  if (!cfg) throw new Error(`Unsupported OAuth provider: ${provider}`);

  if (isMockEnabled(provider)) {
    const origin = new URL(redirectUri).origin;
    const params = new URLSearchParams({
      provider,
      state,
      redirect_uri: redirectUri,
    });
    return `${origin}/auth/mock?${params.toString()}`;
  }

  const { clientId } = getClientCredentials(provider);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: cfg.scopes,
    state,
  });

  // Google requires prompt=consent for reliable offline refresh
  if (provider === "google") {
    params.set("prompt", "consent");
  }

  return `${cfg.authorizeUrl}?${params.toString()}`;
}

/**
 * Exchange an authorization code for an access token.
 *
 * @param {string} provider
 * @param {string} code
 * @param {string} redirectUri
 * @returns {Promise<string>} access token
 */
export async function exchangeCode(provider, code, redirectUri) {
  const cfg = PROVIDERS[provider];
  if (!cfg) throw new Error(`Unsupported OAuth provider: ${provider}`);

  if (isMockEnabled(provider) && code && code.startsWith("mock-code-")) {
    const parts = code.split("-");
    const emailEncoded = parts.slice(3).join("-");
    return `mock-token-${provider}-${emailEncoded}`;
  }

  const { clientId, clientSecret } = getClientCredentials(provider);

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const headers = { "Content-Type": "application/x-www-form-urlencoded" };
  // GitHub requires Accept: application/json to return JSON instead of form-encoded
  if (provider === "github") {
    headers["Accept"] = "application/json";
  }

  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers,
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed for ${provider}: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.access_token;
}

/**
 * Fetch the authenticated user's profile (email + display name).
 *
 * @param {string} provider
 * @param {string} accessToken
 * @returns {Promise<{ email: string, name: string }>}
 */
export async function fetchUserProfile(provider, accessToken) {
  const cfg = PROVIDERS[provider];
  if (!cfg) throw new Error(`Unsupported OAuth provider: ${provider}`);

  if (isMockEnabled(provider) && accessToken && accessToken.startsWith(`mock-token-${provider}-`)) {
    const prefix = `mock-token-${provider}-`;
    const encoded = accessToken.substring(prefix.length);
    let email = "";
    try {
      email = Buffer.from(encoded, "base64").toString("utf-8");
      if (!email.includes("@")) {
        email = "mock-user@example.com";
      }
    } catch (e) {
      email = "mock-user@example.com";
    }
    const name = email.split("@")[0] || "Mock User";
    return { email, name };
  }

  const headers = { Authorization: `Bearer ${accessToken}` };
  // GitHub API requires a User-Agent header
  if (provider === "github") {
    headers["User-Agent"] = "wheel-app";
  }

  const res = await fetch(cfg.userinfoUrl, { headers });
  if (!res.ok) {
    throw new Error(`Userinfo fetch failed for ${provider}: ${res.status}`);
  }

  const data = await res.json();

  if (provider === "google") {
    return { email: data.email, name: data.name || data.email.split("@")[0] };
  }

  if (provider === "microsoft") {
    // Microsoft Graph returns mail or userPrincipalName
    const email = data.mail || data.userPrincipalName || "";
    return { email, name: data.displayName || email.split("@")[0] };
  }

  if (provider === "github") {
    // GitHub may not include email in /user — fetch from /user/emails
    let email = data.email;
    if (!email) {
      const emailsRes = await fetch(cfg.emailsUrl, { headers });
      if (emailsRes.ok) {
        const emails = await emailsRes.json();
        const primary = emails.find((e) => e.primary && e.verified) || emails[0];
        email = primary?.email || "";
      }
    }
    return { email, name: data.name || data.login || email.split("@")[0] };
  }

  throw new Error(`Unsupported provider profile mapping: ${provider}`);
}
