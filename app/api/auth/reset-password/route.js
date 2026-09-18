import { NextResponse } from "next/server";
import { docClient, TableNames } from "@/lib/dynamodb";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { validatePassword } from "@/lib/password";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(req) {
  try {
    // Rate limit: 10 attempts per 15 minutes per IP
    const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
    const { allowed, resetMs } = checkRateLimit(`reset-password:${ip}`, 10, 15 * 60 * 1000);
    if (!allowed) {
      const retryAfterSecs = Math.ceil((resetMs - Date.now()) / 1000);
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(retryAfterSecs) } }
      );
    }

    const { userId, token, newPassword } = await req.json();

    if (!userId || !token || !newPassword) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    // Validate new password
    const { valid, errors } = validatePassword(newPassword);
    if (!valid) {
      return NextResponse.json(
        { error: "Password does not meet requirements.", details: errors },
        { status: 400 }
      );
    }

    // Fetch user
    const { Item: user } = await docClient.send(
      new GetCommand({
        TableName: TableNames.Users,
        Key: { PK: `USER#${userId}` },
      })
    );

    if (!user) {
      return NextResponse.json({ error: "Invalid or expired reset link." }, { status: 400 });
    }

    if (!user.passwordResetToken || !user.passwordResetExpiry) {
      return NextResponse.json({ error: "No password reset was requested for this account." }, { status: 400 });
    }

    // H3: Constant-time token comparison to prevent timing attacks
    const tokenMatch =
      user.passwordResetToken.length === token.length &&
      crypto.timingSafeEqual(
        Buffer.from(user.passwordResetToken),
        Buffer.from(token)
      );
    if (!tokenMatch) {
      return NextResponse.json({ error: "Invalid or expired reset link." }, { status: 400 });
    }

    // Check expiry
    if (new Date(user.passwordResetExpiry) < new Date()) {
      return NextResponse.json(
        { error: "This reset link has expired. Please request a new one." },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update primary user item
    await docClient.send(
      new UpdateCommand({
        TableName: TableNames.Users,
        Key: { PK: `USER#${userId}` },
        UpdateExpression:
          "SET #pw = :p REMOVE passwordResetToken, passwordResetExpiry",
        ExpressionAttributeNames: { "#pw": "password" },
        ExpressionAttributeValues: { ":p": hashedPassword },
      })
    );

    // Update username pointer item
    if (user.username) {
      await docClient.send(
        new UpdateCommand({
          TableName: TableNames.Users,
          Key: { PK: `USER#USERNAME#${user.username}` },
          UpdateExpression:
            "SET #pw = :p REMOVE passwordResetToken, passwordResetExpiry",
          ExpressionAttributeNames: { "#pw": "password" },
          ExpressionAttributeValues: { ":p": hashedPassword },
        })
      );
    }

    return NextResponse.json({ success: true, message: "Password updated successfully. You can now log in." });
  } catch (error) {
    console.error("Reset-password error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
