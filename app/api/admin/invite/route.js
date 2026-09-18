import { NextResponse } from "next/server";
import { docClient, TableNames } from "@/lib/dynamodb";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getSession } from "@/lib/session";
import crypto from "crypto";
import { sendEmail } from "@/lib/email";
import { escapeHtml } from "@/lib/sanitize";
import { getTrustedBaseUrl } from "@/lib/url";

async function requireAdmin() {
  const session = await getSession();
  if (!session) return null;
  if (!session.isAdmin) return null;
  return session;
}

// POST /api/admin/invite — send an invite to an email address
export async function POST(req) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { email } = await req.json();

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
  }

  const loweredEmail = email.toLowerCase();

  // Check if user already exists with this email
  const existing = await docClient.send(new QueryCommand({
    TableName: TableNames.Users,
    IndexName: "EmailOrUsernameIndex",
    KeyConditionExpression: "EmailOrUsername = :v",
    ExpressionAttributeValues: { ":v": loweredEmail },
  }));

  if (existing.Items?.length > 0) {
    return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
  }

  // Generate invite token and store it
  const inviteToken = crypto.randomBytes(32).toString("hex");
  const inviteId = crypto.randomUUID();

  await docClient.send(new PutCommand({
    TableName: TableNames.Users,
    Item: {
      PK: `INVITE#${inviteToken}`,
      inviteId,
      email: loweredEmail,
      EmailOrUsername: `invite#${loweredEmail}`,
      invitedBy: session.userId,
      invitedByUsername: session.username,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
    },
  }));

  const hostUrl = getTrustedBaseUrl(req);
  const inviteLink = `${hostUrl}/signup/invite?token=${inviteToken}`;

  await sendEmail({
    to: loweredEmail,
    subject: "You're Invited to Spin the Wheel!",
    text: `You've been invited by ${session.username} to join Spin the Wheel!\n\nClick the link below to create your account:\n\n${inviteLink}\n\nThis invitation expires in 7 days.`,
    html: `<p>You've been invited by <strong>${escapeHtml(session.username)}</strong> to join Spin the Wheel!</p><p><a href="${inviteLink}">Accept your invitation</a></p><p>This invitation expires in 7 days.</p>`,
  });

  return NextResponse.json({ success: true, email: loweredEmail, inviteLink: process.env.DYNAMODB_ENDPOINT ? inviteLink : undefined });
}
