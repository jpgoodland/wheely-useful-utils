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
    const { allowed, resetMs } = checkRateLimit(`resend-verification:${ip}`, 3, 15 * 60 * 1000);
    if (!allowed) {
      const retryAfterSecs = Math.ceil((resetMs - Date.now()) / 1000);
      return NextResponse.json(
        { error: "Too many requests. Please wait before requesting another email." },
        { status: 429, headers: { "Retry-After": String(retryAfterSecs) } }
      );
    }

    const body = await req.json();
    const email = (body.email ?? "").toLowerCase().trim();

    // Always return success to prevent user enumeration
    const getGenericOk = () => NextResponse.json({
      success: true,
      message: "If an unverified account with that email exists, a new verification link has been sent.",
    });

    if (!email) return getGenericOk();

    // Look up user by email
    const result = await docClient.send(
      new QueryCommand({
        TableName: TableNames.Users,
        IndexName: "EmailOrUsernameIndex",
        KeyConditionExpression: "EmailOrUsername = :e",
        ExpressionAttributeValues: { ":e": email },
      })
    );

    const users = (result.Items ?? []).filter(
      (u) => u.PK.startsWith("USER#") && !u.PK.includes("USERNAME")
    );

    if (users.length === 0) return getGenericOk();

    const user = users[0];

    // If already verified, no need to resend
    if (user.isVerified) return getGenericOk();

    // Generate a fresh verification token with 24-hour expiry (M1)
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Update primary user item
    await docClient.send(
      new UpdateCommand({
        TableName: TableNames.Users,
        Key: { PK: `USER#${user.userId}` },
        UpdateExpression: "SET verificationToken = :t, verificationTokenExpiry = :e",
        ExpressionAttributeValues: { ":t": verificationToken, ":e": verificationTokenExpiry },
      })
    );

    // Update username pointer item
    if (user.username) {
      await docClient.send(
        new UpdateCommand({
          TableName: TableNames.Users,
          Key: { PK: `USER#USERNAME#${user.username}` },
          UpdateExpression: "SET verificationToken = :t, verificationTokenExpiry = :e",
          ExpressionAttributeValues: { ":t": verificationToken, ":e": verificationTokenExpiry },
        })
      );
    }

    const hostUrl = getTrustedBaseUrl(req);
    const verificationLink = `${hostUrl}/verify?userId=${user.userId}&token=${verificationToken}`;

    await sendEmail({
      to: user.email,
      subject: "Verify Your Account – New Link",
      text: `Here is a new verification link for your Spin the Wheel account:\n\n${verificationLink}\n\nThis link is valid and will replace any previous links.`,
      html: `
        <p>Here is a new verification link for your <strong>Spin the Wheel</strong> account:</p>
        <p><a href="${verificationLink}">Verify my account</a></p>
        <p style="color:#888;">This link replaces any previous verification links.</p>
      `,
    });

    return getGenericOk();
  } catch (error) {
    console.error("Resend-verification error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
