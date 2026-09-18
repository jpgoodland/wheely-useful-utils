import { NextResponse } from "next/server";
import { docClient, TableNames } from "@/lib/dynamodb";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import crypto from "crypto";

export async function POST(req) {
  try {
    const { userId, token } = await req.json();

    if (!userId || !token) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const { Item: user } = await docClient.send(new GetCommand({
      TableName: TableNames.Users,
      Key: { PK: `USER#${userId}` }
    }));

    if (!user) {
      return NextResponse.json({ error: "User lookup failed. Account may not exist." }, { status: 404 });
    }

    if (user.isVerified) {
      return NextResponse.json({ error: "Account is already fully verified." }, { status: 400 });
    }

    // M1: Check verification token expiry (24 hours)
    if (user.verificationTokenExpiry && new Date(user.verificationTokenExpiry) < new Date()) {
      return NextResponse.json({ error: "Verification link has expired. Please request a new one." }, { status: 400 });
    }

    // H3: Constant-time token comparison to prevent timing attacks
    const tokenMatch =
      user.verificationToken.length === token.length &&
      crypto.timingSafeEqual(
        Buffer.from(user.verificationToken),
        Buffer.from(token)
      );
    if (!tokenMatch) {
      return NextResponse.json({ error: "Invalid or expired verification token." }, { status: 400 });
    }

    // Process Token Resolution
    // Update the primary item (PK: USER#<userId>)
    await docClient.send(new UpdateCommand({
      TableName: TableNames.Users,
      Key: { PK: `USER#${userId}` },
      UpdateExpression: "SET isVerified = :v REMOVE verificationToken",
      ExpressionAttributeValues: {
        ":v": true
      }
    }));

    // Also update the username pointer item (PK: USER#USERNAME#<username>)
    // so login-by-username also sees isVerified = true.
    if (user.username) {
      await docClient.send(new UpdateCommand({
        TableName: TableNames.Users,
        Key: { PK: `USER#USERNAME#${user.username}` },
        UpdateExpression: "SET isVerified = :v REMOVE verificationToken",
        ExpressionAttributeValues: {
          ":v": true
        }
      }));
    }

    return NextResponse.json({ success: true, message: "Email effectively verified and activated" });
  } catch (error) {
    console.error("Verification backend block error:", error);
    return NextResponse.json({ error: "Internal server resolution error" }, { status: 500 });
  }
}
