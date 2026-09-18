import { NextResponse } from "next/server";
import { docClient, TableNames } from "@/lib/dynamodb";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { sendEmail } from "@/lib/email";
import { validatePassword } from "@/lib/password";
import { checkRateLimit } from "@/lib/rateLimit";
import { getTrustedBaseUrl } from "@/lib/url";
import { escapeHtml } from "@/lib/sanitize";

export async function POST(req) {
  try {
    // L1: Rate limit — 5 signups per 15 minutes per IP
    const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
    const { allowed, resetMs } = checkRateLimit(`signup:${ip}`, 5, 15 * 60 * 1000);
    if (!allowed) {
      const retryAfterSecs = Math.ceil((resetMs - Date.now()) / 1000);
      return NextResponse.json(
        { error: "Too many signup attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(retryAfterSecs) } }
      );
    }

    const { email, username, password, firstName, lastName } = await req.json();

    if (!email || !username || !password || !firstName || !lastName) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    if (
      typeof firstName !== "string" ||
      firstName.trim().length === 0 ||
      firstName.trim().length > 50 ||
      typeof lastName !== "string" ||
      lastName.trim().length === 0 ||
      lastName.trim().length > 50
    ) {
      return NextResponse.json({ error: "First and last name must each be between 1 and 50 characters" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    // Server-side password validation (authoritative)
    const { valid: pwValid, errors: pwErrors } = validatePassword(password);
    if (!pwValid) {
      return NextResponse.json(
        { error: "Password does not meet requirements: " + pwErrors.join("; ") },
        { status: 400 }
      );
    }

    // Check if user exists by querying the GSI
    const existing = await docClient.send(new QueryCommand({
      TableName: TableNames.Users,
      IndexName: "EmailOrUsernameIndex",
      KeyConditionExpression: "EmailOrUsername = :eu",
      ExpressionAttributeValues: {
        ":eu": email.toLowerCase(),
      }
    }));

    if (existing.Items && existing.Items.length > 0) {
      return NextResponse.json({ error: "User already exists with this email" }, { status: 409 });
    }

    // Check username
    const existingUser = await docClient.send(new QueryCommand({
      TableName: TableNames.Users,
      IndexName: "EmailOrUsernameIndex",
      KeyConditionExpression: "EmailOrUsername = :eu",
      ExpressionAttributeValues: {
        ":eu": username.toLowerCase(),
      }
    }));

    if (existingUser.Items && existingUser.Items.length > 0) {
        return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();
    const verificationToken = crypto.randomBytes(32).toString('hex');
    // M1: Verification token expires after 24 hours
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    // Admin check via env var allowlist
    const adminEmails = process.env.ADMIN_EMAILS;
    const isAdmin = adminEmails
      ? adminEmails.split(",").map(e => e.trim().toLowerCase()).includes(email.toLowerCase())
      : false;

    const userItem = {
      PK: `USER#${userId}`,
      userId,
      email: email.toLowerCase(),
      username: username.toLowerCase(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      EmailOrUsername: email.toLowerCase(),
      password: hashedPassword,
      isVerified: false,
      isAdmin,
      authProvider: "credentials",
      verificationToken,
      verificationTokenExpiry,
      createdAt: new Date().toISOString(),
    };

    // Store user by email
    await docClient.send(new PutCommand({
      TableName: TableNames.Users,
      Item: userItem,
    }));

    // For username lookup, we can store a pointer item, but we'll cheat a bit and just Put another item for username
    await docClient.send(new PutCommand({
        TableName: TableNames.Users,
        Item: {
            ...userItem,
            PK: `USER#USERNAME#${username.toLowerCase()}`,
            EmailOrUsername: username.toLowerCase()
        }
    }));

    const hostUrl = getTrustedBaseUrl(req);
    const verificationLink = `${hostUrl}/verify?userId=${userId}&token=${verificationToken}`;
    const greetingName = firstName.trim() || username;

    await sendEmail({
      to: email,
      subject: "Verify Your Account",
      text: `Hello ${greetingName},\n\nWelcome! Please verify your account by clicking this link:\n\n${verificationLink}`,
      html: `<p>Hello ${escapeHtml(greetingName)},</p><p>Welcome! Please verify your account by clicking the link below:</p><p><a href="${verificationLink}">Verify my account</a></p>`,
    });

    return NextResponse.json({ success: true, message: "Please check your email to verify your account" });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
