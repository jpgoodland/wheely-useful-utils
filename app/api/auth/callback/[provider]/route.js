import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCode, fetchUserProfile, getBaseUrl, getProviderConfig } from "@/lib/oauth";
import { signToken } from "@/lib/auth";
import { docClient, TableNames } from "@/lib/dynamodb";
import { PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import crypto from "crypto";

/**
 * GET /api/auth/callback/[provider]
 *
 * Handles the OAuth callback after the user authorises with the provider.
 *
 * 1. Validates the CSRF state token
 * 2. Exchanges the authorization code for an access token
 * 3. Fetches the user profile (email, name)
 * 4. Finds or creates the user in DynamoDB
 * 5. Issues our JWT and sets the auth_token cookie
 * 6. Redirects to /dashboard
 */
export async function GET(req, { params }) {
  const { provider } = await params;
  const baseUrl = getBaseUrl(req);

  const cfg = getProviderConfig(provider);
  if (!cfg) {
    return NextResponse.redirect(new URL("/login?error=unsupported_provider", baseUrl));
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  // Provider returned an error (e.g. user denied consent)
  if (errorParam) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(errorParam)}`, baseUrl));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL("/login?error=missing_params", baseUrl));
  }

  // CSRF check — H3: constant-time comparison to prevent timing attacks
  const cookieStore = await cookies();
  const savedState = cookieStore.get("oauth_state")?.value;
  if (
    !savedState ||
    savedState.length !== state.length ||
    !crypto.timingSafeEqual(Buffer.from(savedState), Buffer.from(state))
  ) {
    return NextResponse.redirect(new URL("/login?error=invalid_state", baseUrl));
  }

  try {
    // Build redirect URI (must match the one used in the initial request)
    const redirectUri = `${baseUrl}/api/auth/callback/${provider}`;

    // Exchange code → access token → user profile
    const accessToken = await exchangeCode(provider, code, redirectUri);
    const profile = await fetchUserProfile(provider, accessToken);

    if (!profile.email) {
      return NextResponse.redirect(new URL("/login?error=no_email", baseUrl));
    }

    const email = profile.email.toLowerCase();

    // Look up existing user by email
    const existing = await docClient.send(new QueryCommand({
      TableName: TableNames.Users,
      IndexName: "EmailOrUsernameIndex",
      KeyConditionExpression: "EmailOrUsername = :email",
      ExpressionAttributeValues: { ":email": email },
    }));

    let user;

    if (existing.Items && existing.Items.length > 0) {
      // User exists — link provider if not already linked
      user = existing.Items[0];

      const providers = user.oauthProviders || [];
      if (!providers.includes(provider)) {
        providers.push(provider);
        await docClient.send(new UpdateCommand({
          TableName: TableNames.Users,
          Key: { PK: user.PK },
          UpdateExpression: "SET oauthProviders = :p, isVerified = :v",
          ExpressionAttributeValues: {
            ":p": providers,
            ":v": true,
          },
        }));
        // Also update the username pointer item
        if (user.username) {
          await docClient.send(new UpdateCommand({
            TableName: TableNames.Users,
            Key: { PK: `USER#USERNAME#${user.username}` },
            UpdateExpression: "SET oauthProviders = :p, isVerified = :v",
            ExpressionAttributeValues: {
              ":p": providers,
              ":v": true,
            },
          }));
        }
      }
    } else {
      // New user — create account (no password, pre-verified)
      const userId = crypto.randomUUID();
      const username = await generateUniqueUsername(email);
      // Admin check via env var allowlist
      const adminEmails = process.env.ADMIN_EMAILS;
      const isAdmin = adminEmails
        ? adminEmails.split(",").map(e => e.trim().toLowerCase()).includes(email.toLowerCase())
        : false;

      let firstName = null;
      let lastName = null;
      if (profile.name) {
        const parts = profile.name.trim().split(/\s+/);
        firstName = parts[0] || null;
        lastName = parts.slice(1).join(" ") || null;
      }

      const userItem = {
        PK: `USER#${userId}`,
        userId,
        email,
        username,
        firstName,
        lastName,
        EmailOrUsername: email,
        isVerified: true,
        isAdmin,
        authProvider: provider,
        oauthProviders: [provider],
        createdAt: new Date().toISOString(),
      };

      // Store primary user item
      await docClient.send(new PutCommand({
        TableName: TableNames.Users,
        Item: userItem,
      }));

      // Store username pointer
      await docClient.send(new PutCommand({
        TableName: TableNames.Users,
        Item: {
          ...userItem,
          PK: `USER#USERNAME#${username}`,
          EmailOrUsername: username,
        },
      }));

      user = userItem;
    }

    // Issue JWT
    const token = await signToken({
      userId: user.userId,
      email: user.email,
      username: user.username,
      firstName: user.firstName || null,
      lastName: user.lastName || null,
      isAdmin: user.isAdmin === true,
    });

    const response = NextResponse.redirect(new URL("/dashboard", baseUrl));

    response.cookies.set({
      name: "auth_token",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 30, // 30 minutes
      sameSite: "lax", // Lax required — callback is a cross-site redirect completion
    });

    // Clear the CSRF cookie
    response.cookies.set({
      name: "oauth_state",
      value: "",
      httpOnly: true,
      path: "/api/auth/callback",
      maxAge: 0,
    });
    response.cookies.set({
      name: "oauth_state",
      value: "",
      httpOnly: true,
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error(`OAuth callback error (${provider}):`, error);
    return NextResponse.redirect(new URL("/login?error=oauth_failed", baseUrl));
  }
}

/**
 * Generate a unique username from an email prefix.
 * If the base name is taken, append a random 4-char hex suffix.
 */
async function generateUniqueUsername(email) {
  const base = email.split("@")[0]
    .replace(/[^a-z0-9_-]/gi, "")
    .substring(0, 20)
    .toLowerCase();

  const candidate = base || "user";

  // Check if username is taken
  const check = await docClient.send(new QueryCommand({
    TableName: TableNames.Users,
    IndexName: "EmailOrUsernameIndex",
    KeyConditionExpression: "EmailOrUsername = :u",
    ExpressionAttributeValues: { ":u": candidate },
  }));

  if (!check.Items || check.Items.length === 0) {
    return candidate;
  }

  // Append random suffix
  const suffix = crypto.randomBytes(2).toString("hex");
  return `${candidate}_${suffix}`;
}
