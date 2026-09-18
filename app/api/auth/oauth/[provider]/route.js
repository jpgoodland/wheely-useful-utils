import { NextResponse } from "next/server";
import { getAuthUrl, getBaseUrl, getProviderConfig } from "@/lib/oauth";
import crypto from "crypto";

/**
 * GET /api/auth/oauth/[provider]
 *
 * Initiates the OAuth flow by redirecting the browser to the provider's
 * authorization endpoint. A random `state` token is stored in a short-lived
 * httpOnly cookie for CSRF protection.
 */
export async function GET(req, { params }) {
  const { provider } = await params;

  const cfg = getProviderConfig(provider);
  if (!cfg) {
    return NextResponse.json(
      { error: `Unsupported OAuth provider: ${provider}` },
      { status: 400 }
    );
  }

  // Build the callback URL using the canonical base URL
  const baseUrl = getBaseUrl(req);
  const redirectUri = `${baseUrl}/api/auth/callback/${provider}`;

  // Generate CSRF state token
  const state = crypto.randomBytes(20).toString("hex");

  const authUrl = getAuthUrl(provider, state, redirectUri);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set({
    name: "oauth_state",
    value: state,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/callback",
    maxAge: 60 * 10, // 10 minutes
    sameSite: "lax", // Lax required — callback is a cross-site redirect
  });

  return response;
}
