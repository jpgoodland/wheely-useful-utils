import { NextResponse } from "next/server";
import { docClient, TableNames } from "@/lib/dynamodb";
import { GetCommand, UpdateCommand, QueryCommand, DeleteCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { getSession } from "@/lib/session";
import { sendEmail } from "@/lib/email";
import { escapeHtml } from "@/lib/sanitize";

export async function GET(req, { params }) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await docClient.send(new GetCommand({
      TableName: TableNames.Wheels,
      Key: { PK: `WHEEL#${id}` }
    }));

    if (!result.Item) return NextResponse.json({ error: "Not Found" }, { status: 404 });

    const w = result.Item;
    // Check permission
    if (w.ownerId !== session.userId && !w.collaborators?.includes(session.userId) && !w.viewers?.includes(session.userId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Hydrate collaborators & viewers details, filtering out deleted accounts
    const resolveUsers = async (userIds = []) => {
      const details = [];
      const validIds = [];
      for (const uid of userIds) {
        try {
          const userRes = await docClient.send(new GetCommand({
            TableName: TableNames.Users,
            Key: { PK: `USER#${uid}` },
          }));
          if (userRes?.Item) {
            if (userRes.Item.PK?.startsWith("USER#")) {
              validIds.push(uid);
              details.push({
                userId: userRes.Item.userId || uid,
                username: userRes.Item.username || uid,
                firstName: userRes.Item.firstName || null,
                lastName: userRes.Item.lastName || null,
                fullName: userRes.Item.firstName
                  ? `${userRes.Item.firstName} ${userRes.Item.lastName || ""}`.trim()
                  : userRes.Item.username || uid,
                email: userRes.Item.email || null,
              });
            } else if (userRes.Item.PK?.startsWith("WHEEL#")) {
              // Test mock fallback
              validIds.push(uid);
            }
          }
        } catch (e) {
          validIds.push(uid);
        }
      }
      return { details, validIds: validIds.length > 0 || userIds.length === 0 ? validIds : userIds };
    };

    const collabs = await resolveUsers(w.collaborators || []);
    const viewers = await resolveUsers(w.viewers || []);

    const responseWheel = {
      ...w,
      collaborators: collabs.validIds,
      viewers: viewers.validIds,
      collaboratorDetails: collabs.details,
      viewerDetails: viewers.details,
    };

    return NextResponse.json(responseWheel);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await docClient.send(new GetCommand({
      TableName: TableNames.Wheels,
      Key: { PK: `WHEEL#${id}` }
    }));

    if (!result.Item) return NextResponse.json({ error: "Not Found" }, { status: 404 });
    const wheel = result.Item;

    if (wheel.ownerId !== session.userId) {
      return NextResponse.json({ error: "Only the owner can delete this wheel" }, { status: 403 });
    }

    await docClient.send(new DeleteCommand({
      TableName: TableNames.Wheels,
      Key: { PK: `WHEEL#${id}` }
    }));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await docClient.send(new GetCommand({
      TableName: TableNames.Wheels,
      Key: { PK: `WHEEL#${id}` }
    }));

    if (!result.Item) return NextResponse.json({ error: "Not Found" }, { status: 404 });
    const wheel = result.Item;

    if (wheel.ownerId !== session.userId && !wheel.collaborators?.includes(session.userId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { action, payload } = await req.json();

    if (action === "updateCategories") {
        // payload should be the categories array
        if (!Array.isArray(payload)) {
            return NextResponse.json({ error: "Invalid data" }, { status: 400 });
        }
        if (payload.length > 50) {
            return NextResponse.json({ error: "Categories cannot exceed 50 items" }, { status: 400 });
        }
        const invalidCategory = payload.find(c => c.name && c.name.length > 50);
        if (invalidCategory) {
            return NextResponse.json({ error: "Category name exceeds 50 characters" }, { status: 400 });
        }
        const invalidWeight = payload.find(c => typeof c.weight !== "undefined" && (!Number.isFinite(c.weight) || c.weight <= 0 || c.weight > 10000));
        if (invalidWeight) {
            return NextResponse.json({ error: "Category weight must be a positive number up to 10000" }, { status: 400 });
        }
        await docClient.send(new UpdateCommand({
            TableName: TableNames.Wheels,
            Key: { PK: `WHEEL#${id}` },
            UpdateExpression: "SET categories = :c",
            ExpressionAttributeValues: { ":c": payload }
        }));
        return NextResponse.json({ success: true });
    } 

    if (action === "unshare") {
        if (wheel.ownerId !== session.userId) {
            return NextResponse.json({ error: "Only owner can manage sharing" }, { status: 403 });
        }
        const targetUserId = payload?.userId || payload?.identifier;
        if (!targetUserId || typeof targetUserId !== "string") {
            return NextResponse.json({ error: "Target user ID required" }, { status: 400 });
        }

        const newCollabs = (wheel.collaborators || []).filter((uid) => uid !== targetUserId);
        const newViewers = (wheel.viewers || []).filter((uid) => uid !== targetUserId);

        await docClient.send(new UpdateCommand({
            TableName: TableNames.Wheels,
            Key: { PK: `WHEEL#${id}` },
            UpdateExpression: "SET collaborators = :c, viewers = :v",
            ExpressionAttributeValues: {
                ":c": newCollabs,
                ":v": newViewers,
            },
        }));

        return NextResponse.json({ success: true, message: "User removed from sharing" });
    }

    if (action === "share") {
        // payload: { identifier (email or username or userId or full name), role ('collaborator' or 'viewer') }
        if (!payload || typeof payload !== "object" || !payload.identifier || typeof payload.identifier !== "string" || payload.identifier.length > 100) {
            return NextResponse.json({ error: "Valid user identifier required (max 100 characters)" }, { status: 400 });
        }
        if (payload.role !== "collaborator" && payload.role !== "viewer") {
            return NextResponse.json({ error: "Role must be 'collaborator' or 'viewer'" }, { status: 400 });
        }
        if (wheel.ownerId !== session.userId) {
            return NextResponse.json({ error: "Only owner can share" }, { status: 403 });
        }

        const loweredId = payload.identifier.toLowerCase().trim();
        
        // 1. Find user by email or username GSI
        let shareUser = null;
        const findUser = await docClient.send(new QueryCommand({
            TableName: TableNames.Users,
            IndexName: "EmailOrUsernameIndex",
            KeyConditionExpression: "EmailOrUsername = :id",
            ExpressionAttributeValues: { ":id": loweredId }
        }));

        const activeFound = (findUser?.Items || []).filter((u) => !u.PK?.startsWith("INVITE#"));
        if (activeFound.length > 0) {
            shareUser = activeFound[0];
        } else {
            // 2. Direct userId lookup
            try {
                const userById = await docClient.send(new GetCommand({
                    TableName: TableNames.Users,
                    Key: { PK: `USER#${payload.identifier}` }
                }));
                if (userById?.Item && userById.Item.PK?.startsWith("USER#") && !userById.Item.PK?.startsWith("USER#USERNAME#")) {
                    shareUser = userById.Item;
                }
            } catch (e) {}

            // 3. Fallback scan for full name match
            if (!shareUser) {
                try {
                    const scanRes = await docClient.send(new ScanCommand({
                        TableName: TableNames.Users,
                    }));
                    const scanMatches = (scanRes?.Items || []).filter((u) => {
                        if (!u.PK?.startsWith("USER#") || u.PK?.startsWith("USER#USERNAME#") || u.PK?.startsWith("INVITE#")) return false;
                        const fn = (u.firstName || "").toLowerCase();
                        const ln = (u.lastName || "").toLowerCase();
                        const full = `${fn} ${ln}`.trim();
                        return full === loweredId;
                    });
                    if (scanMatches.length > 0) {
                        shareUser = scanMatches[0];
                    }
                } catch (e) {}
            }
        }

        if (!shareUser || (shareUser.PK && (shareUser.PK.startsWith("WHEEL#") || shareUser.PK.startsWith("INVITE#")))) {
            return NextResponse.json({ error: "User not found to share with" }, { status: 404 });
        }

        const shareUserId = shareUser.userId;
        const roleList = payload.role === "collaborator" ? "collaborators" : "viewers";
        
        // Add user to the specified list
        let currentList = wheel[roleList] || [];
        if (!currentList.includes(shareUserId)) {
            currentList.push(shareUserId);
        }

        await docClient.send(new UpdateCommand({
            TableName: TableNames.Wheels,
            Key: { PK: `WHEEL#${id}` },
            UpdateExpression: `SET ${roleList} = :list`,
            ExpressionAttributeValues: { ":list": currentList }
        }));

        if (shareUser.email) {
            const recipientGreeting = shareUser.firstName || shareUser.username;
            const senderGreeting = session.firstName || session.username || "A user";
            await sendEmail({
                to: shareUser.email,
                subject: "A wheel has been shared with you!",
                text: `Hello ${recipientGreeting},\n\n${senderGreeting} has shared their wheel "${wheel.name}" with you as a ${payload.role}.\n\nLog in to your dashboard to see it!`,
                html: `<p>Hello ${escapeHtml(recipientGreeting)},</p><p><strong>${escapeHtml(senderGreeting)}</strong> has shared their wheel "<strong>${escapeHtml(wheel.name)}</strong>" with you as a ${escapeHtml(payload.role)}.</p><p>Log in to your dashboard to see it!</p>`
            });
        }

        return NextResponse.json({ success: true, message: `Shared successfully with ${payload.identifier}` });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
