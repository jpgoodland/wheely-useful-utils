import { NextResponse } from "next/server";
import { docClient, TableNames } from "@/lib/dynamodb";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { getSession } from "@/lib/session";
import { checkRateLimit } from "@/lib/rateLimit";

export async function GET(req) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
    const { allowed, resetMs } = checkRateLimit(`user-search:${ip}`, 30, 60 * 1000);
    if (!allowed) {
      const retryAfterSecs = Math.ceil((resetMs - Date.now()) / 1000);
      return NextResponse.json(
        { error: "Too many search requests. Please slow down." },
        { status: 429, headers: { "Retry-After": String(retryAfterSecs) } }
      );
    }

    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();

    if (q.length < 2) {
      return NextResponse.json([]);
    }

    // Scan users table for active user records
    const result = await docClient.send(new ScanCommand({
      TableName: TableNames.Users,
    }));

    const items = result.Items || [];

    const matches = items
      .filter((u) => {
        // Only primary user records (skip pointers, invites, deleted markers)
        if (!u.PK || !u.PK.startsWith("USER#") || u.PK.startsWith("USER#USERNAME#") || u.PK.startsWith("INVITE#")) {
          return false;
        }

        // Exclude current user
        if (u.userId === session.userId) {
          return false;
        }

        const username = (u.username || "").toLowerCase();
        const email = (u.email || "").toLowerCase();
        const firstName = (u.firstName || "").toLowerCase();
        const lastName = (u.lastName || "").toLowerCase();
        const fullName = `${firstName} ${lastName}`.trim();

        return (
          username.includes(q) ||
          email.includes(q) ||
          firstName.includes(q) ||
          lastName.includes(q) ||
          fullName.includes(q)
        );
      })
      .slice(0, 10)
      .map((u) => {
        const fullName = u.firstName
          ? `${u.firstName} ${u.lastName || ""}`.trim()
          : u.username;

        return {
          userId: u.userId,
          username: u.username,
          email: u.email,
          firstName: u.firstName || null,
          lastName: u.lastName || null,
          fullName,
        };
      });

    return NextResponse.json(matches);
  } catch (error) {
    console.error("User search error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
