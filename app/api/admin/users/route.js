import { NextResponse } from "next/server";
import { docClient, TableNames } from "@/lib/dynamodb";
import { ScanCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getSession } from "@/lib/session";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { validatePassword } from "@/lib/password";

async function requireAdmin() {
  const session = await getSession();
  if (!session) return null;
  if (!session.isAdmin) return null;
  return session;
}

// GET /api/admin/users — list all users (primary items only, not username pointers)
export async function GET() {
  if (!await requireAdmin()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await docClient.send(new ScanCommand({ TableName: TableNames.Users }));
  // Filter to primary user items only (exclude username pointer items)
  const users = (result.Items || [])
    .filter(u => u.PK.startsWith("USER#") && !u.PK.startsWith("USER#USERNAME#"))
    .map(({ PK, userId, email, username, firstName, lastName, isAdmin, isVerified, createdAt }) => ({
      PK, userId, email, username, firstName: firstName || null, lastName: lastName || null, isAdmin: !!isAdmin, isVerified: !!isVerified, createdAt
    }));

  return NextResponse.json(users);
}

// POST /api/admin/users — create a user directly (pre-verified, no email sent)
export async function POST(req) {
  if (!await requireAdmin()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { email, username, password, firstName, lastName, isAdmin = false } = await req.json();

  if (!email || !username || !password) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  if (firstName && (typeof firstName !== "string" || firstName.trim().length > 50)) {
    return NextResponse.json({ error: "First name must be at most 50 characters" }, { status: 400 });
  }
  if (lastName && (typeof lastName !== "string" || lastName.trim().length > 50)) {
    return NextResponse.json({ error: "Last name must be at most 50 characters" }, { status: 400 });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
  }

  // L5: Validate password strength (same rules as regular signup)
  const { valid: pwValid, errors: pwErrors } = validatePassword(password);
  if (!pwValid) {
    return NextResponse.json(
      { error: "Password does not meet requirements: " + pwErrors.join("; ") },
      { status: 400 }
    );
  }

  // Check email uniqueness
  const existingEmail = await docClient.send(new QueryCommand({
    TableName: TableNames.Users,
    IndexName: "EmailOrUsernameIndex",
    KeyConditionExpression: "EmailOrUsername = :v",
    ExpressionAttributeValues: { ":v": email.toLowerCase() },
  }));
  if (existingEmail.Items?.length > 0) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  // Check username uniqueness
  const existingUsername = await docClient.send(new QueryCommand({
    TableName: TableNames.Users,
    IndexName: "EmailOrUsernameIndex",
    KeyConditionExpression: "EmailOrUsername = :v",
    ExpressionAttributeValues: { ":v": username.toLowerCase() },
  }));
  if (existingUsername.Items?.length > 0) {
    return NextResponse.json({ error: "Username already taken" }, { status: 409 });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const userId = crypto.randomUUID();

  const userItem = {
    PK: `USER#${userId}`,
    userId,
    email: email.toLowerCase(),
    username: username.toLowerCase(),
    firstName: firstName ? firstName.trim() : null,
    lastName: lastName ? lastName.trim() : null,
    EmailOrUsername: email.toLowerCase(),
    password: hashedPassword,
    isVerified: true, // admin-created users are pre-verified
    isAdmin: !!isAdmin,
    createdAt: new Date().toISOString(),
  };

  await docClient.send(new PutCommand({ TableName: TableNames.Users, Item: userItem }));
  await docClient.send(new PutCommand({
    TableName: TableNames.Users,
    Item: { ...userItem, PK: `USER#USERNAME#${username.toLowerCase()}`, EmailOrUsername: username.toLowerCase() },
  }));

  const { password: _, ...safeUser } = userItem;
  return NextResponse.json(safeUser);
}
