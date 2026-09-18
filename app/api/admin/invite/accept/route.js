import { NextResponse } from "next/server";
import { docClient, TableNames } from "@/lib/dynamodb";
import { GetCommand, PutCommand, DeleteCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { validatePassword } from "@/lib/password";
import { checkRateLimit } from "@/lib/rateLimit";

// GET /api/admin/invite/accept?token=xxx — validate an invite token and return the email
export async function GET(req) {
  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
  const { allowed, resetMs } = checkRateLimit(`invite-check:${ip}`, 20, 15 * 60 * 1000);
  if (!allowed) {
    const retryAfterSecs = Math.ceil((resetMs - Date.now()) / 1000);
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfterSecs) } }
    );
  }

  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing invite token" }, { status: 400 });
  }

  const { Item: invite } = await docClient.send(new GetCommand({
    TableName: TableNames.Users,
    Key: { PK: `INVITE#${token}` },
  }));

  if (!invite) {
    return NextResponse.json({ error: "Invalid or expired invitation" }, { status: 404 });
  }

  if (new Date(invite.expiresAt) < new Date()) {
    return NextResponse.json({ error: "This invitation has expired" }, { status: 410 });
  }

  return NextResponse.json({
    email: invite.email,
    invitedBy: invite.invitedByUsername,
  });
}

// POST /api/admin/invite/accept — accept an invite, create the account
export async function POST(req) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
    const { allowed, resetMs } = checkRateLimit(`invite-accept:${ip}`, 10, 15 * 60 * 1000);
    if (!allowed) {
      const retryAfterSecs = Math.ceil((resetMs - Date.now()) / 1000);
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(retryAfterSecs) } }
      );
    }

    const { token, username, password, firstName, lastName } = await req.json();

    if (!token || !username || !password) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    if (firstName && (typeof firstName !== "string" || firstName.trim().length === 0 || firstName.trim().length > 50)) {
      return NextResponse.json({ error: "First name must be between 1 and 50 characters" }, { status: 400 });
    }

    if (lastName && (typeof lastName !== "string" || lastName.trim().length === 0 || lastName.trim().length > 50)) {
      return NextResponse.json({ error: "Last name must be between 1 and 50 characters" }, { status: 400 });
    }

    // Server-side password validation
    const { valid: pwValid, errors: pwErrors } = validatePassword(password);
    if (!pwValid) {
      return NextResponse.json(
        { error: "Password does not meet requirements: " + pwErrors.join("; ") },
        { status: 400 }
      );
    }

    // Look up the invite
    const { Item: invite } = await docClient.send(new GetCommand({
      TableName: TableNames.Users,
      Key: { PK: `INVITE#${token}` },
    }));

    if (!invite) {
      return NextResponse.json({ error: "Invalid or expired invitation" }, { status: 404 });
    }

    if (new Date(invite.expiresAt) < new Date()) {
      return NextResponse.json({ error: "This invitation has expired" }, { status: 410 });
    }

    const email = invite.email;

    // Check email isn't already registered
    const existingEmail = await docClient.send(new QueryCommand({
      TableName: TableNames.Users,
      IndexName: "EmailOrUsernameIndex",
      KeyConditionExpression: "EmailOrUsername = :v",
      ExpressionAttributeValues: { ":v": email },
    }));

    // Filter out invite pointer items
    const realUsers = (existingEmail.Items || []).filter(i => !i.PK.startsWith("INVITE#"));
    if (realUsers.length > 0) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }

    // Check username uniqueness
    const existingUsername = await docClient.send(new QueryCommand({
      TableName: TableNames.Users,
      IndexName: "EmailOrUsernameIndex",
      KeyConditionExpression: "EmailOrUsername = :v",
      ExpressionAttributeValues: { ":v": username.toLowerCase() },
    }));

    const realUsernameUsers = (existingUsername.Items || []).filter(i => !i.PK.startsWith("INVITE#"));
    if (realUsernameUsers.length > 0) {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    }

    // Create the user (pre-verified since they were invited)
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();

    // Admin check via env var allowlist
    const adminEmails = process.env.ADMIN_EMAILS;
    const isAdmin = adminEmails
      ? adminEmails.split(",").map(e => e.trim().toLowerCase()).includes(email.toLowerCase())
      : false;

    const userItem = {
      PK: `USER#${userId}`,
      userId,
      email,
      username: username.toLowerCase(),
      firstName: firstName ? firstName.trim() : null,
      lastName: lastName ? lastName.trim() : null,
      EmailOrUsername: email,
      password: hashedPassword,
      isVerified: true,
      isAdmin,
      invitedBy: invite.invitedBy,
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
        PK: `USER#USERNAME#${username.toLowerCase()}`,
        EmailOrUsername: username.toLowerCase(),
      },
    }));

    // Delete the invite token (single-use)
    await docClient.send(new DeleteCommand({
      TableName: TableNames.Users,
      Key: { PK: `INVITE#${token}` },
    }));

    return NextResponse.json({ success: true, message: "Account created successfully! You can now log in." });
  } catch (error) {
    console.error("Invite accept error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
