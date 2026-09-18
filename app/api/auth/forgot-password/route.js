import { NextResponse } from "next/server";
import { docClient, TableNames } from "@/lib/dynamodb";
import { QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import crypto from "crypto";
import { sendEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rateLimit";
import { getTrustedBaseUrl } from "@/lib/url";

export async function POST(req) {
  try {
    // Rate limit: 3 requests per 15 minutes per IP
    const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
    const { allowed, resetMs } = checkRateLimit(`forgot-password:${ip}`, 3, 15 * 60 * 1000);
    if (!allowed) {
      const retryAfterSecs = Math.ceil((resetMs - Date.now()) / 1000);
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(retryAfterSecs) } }
      );
    }

    const body = await req.json();
    const email = (body.email ?? "").toLowerCase().trim();

    // Always return success — never reveal whether an email is registered
    const getGenericOk = () => NextResponse.json({
      success: true,
      message: "If an account with that email exists, a password reset link has been sent.",
    });

    if (!email) return getGenericOk();

    // Look up user
    const result = await docClient.send(
      new QueryCommand({
        TableName: TableNames.Users,
        IndexName: "EmailOrUsernameIndex",
        KeyConditionExpression: "EmailOrUsername = :e",
        ExpressionAttributeValues: { ":e": email },
      })
    );

    const users = (result.Items ?? []).filter((u) => u.PK.startsWith("USER#") && !u.PK.includes("USERNAME"));
    if (users.length === 0) return getGenericOk();

    const user = users[0];

    // Generate a secure token with 1-hour expiry
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    // Update both the primary and username pointer items
    await docClient.send(
      new UpdateCommand({
        TableName: TableNames.Users,
        Key: { PK: `USER#${user.userId}` },
        UpdateExpression: "SET passwordResetToken = :t, passwordResetExpiry = :e",
        ExpressionAttributeValues: { ":t": resetToken, ":e": resetExpiry },
      })
    );

    if (user.username) {
      await docClient.send(
        new UpdateCommand({
          TableName: TableNames.Users,
          Key: { PK: `USER#USERNAME#${user.username}` },
          UpdateExpression: "SET passwordResetToken = :t, passwordResetExpiry = :e",
          ExpressionAttributeValues: { ":t": resetToken, ":e": resetExpiry },
        })
      );
    }

    const hostUrl = getTrustedBaseUrl(req);
    const resetLink = `${hostUrl}/reset-password?userId=${user.userId}&token=${resetToken}`;

    await sendEmail({
      to: user.email,
      subject: "Reset Your Password",
      text: `You requested a password reset for your Spin the Wheel account.\n\nClick the link below to set a new password (valid for 1 hour):\n\n${resetLink}\n\nIf you did not request this, you can safely ignore this email.`,
      html: `
        <p>You requested a password reset for your <strong>Spin the Wheel</strong> account.</p>
        <p>Click the link below to set a new password (valid for 1 hour):</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
        <p style="color:#888;">If you did not request this, you can safely ignore this email.</p>
      `,
    });

    return getGenericOk();
  } catch (error) {
    console.error("Forgot-password error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
