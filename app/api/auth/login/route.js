import { NextResponse } from "next/server";
import { docClient, TableNames } from "@/lib/dynamodb";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import bcrypt from "bcrypt";
import { signToken } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(req) {
  try {
    // H1: Rate limit — 10 attempts per 15 minutes per IP
    const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
    const { allowed, resetMs } = checkRateLimit(`login:${ip}`, 10, 15 * 60 * 1000);
    if (!allowed) {
      const retryAfterSecs = Math.ceil((resetMs - Date.now()) / 1000);
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(retryAfterSecs) } }
      );
    }

    const { identifier, password } = await req.json(); // identifier is email or username

    if (!identifier || !password) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const lowered = identifier.toLowerCase();

    // Find user by GSI
    const authQuery = await docClient.send(new QueryCommand({
      TableName: TableNames.Users,
      IndexName: "EmailOrUsernameIndex",
      KeyConditionExpression: "EmailOrUsername = :id",
      ExpressionAttributeValues: {
        ":id": lowered,
      }
    }));

    if (!authQuery.Items || authQuery.Items.length === 0) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const user = authQuery.Items[0];

    // OAuth-only accounts have no password — guide the user to social login
    if (!user.password) {
      const providers = user.oauthProviders?.join(", ") || user.authProvider || "social login";
      return NextResponse.json(
        { error: `This account uses ${providers}. Please sign in with your social login provider.` },
        { status: 400 }
      );
    }

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    if (user.isVerified === false) {
      return NextResponse.json({ error: "Please verify your email address before logging in. Check your email inbox for a verification link." }, { status: 403 });
    }

    const token = await signToken({
      userId: user.userId,
      email: user.email,
      username: user.username,
      firstName: user.firstName || null,
      lastName: user.lastName || null,
      isAdmin: user.isAdmin === true,
    });

    const response = NextResponse.json({
      success: true,
      userId: user.userId,
      username: user.username,
      firstName: user.firstName || null,
      lastName: user.lastName || null,
      isAdmin: user.isAdmin === true,
    });
    response.cookies.set({
      name: "auth_token",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 30, // 30 minutes
      sameSite: "strict",
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
