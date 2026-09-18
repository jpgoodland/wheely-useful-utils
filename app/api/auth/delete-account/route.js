import { NextResponse } from "next/server";
import { docClient, TableNames } from "@/lib/dynamodb";
import { DeleteCommand, QueryCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { getSession } from "@/lib/session";
import { sendEmail } from "@/lib/email";
import { escapeHtml } from "@/lib/sanitize";

export async function DELETE(req) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId, username, email } = session;

    // 1. Find and delete wheels owned by the user (M4: Query GSI instead of Scan)
    const wheelRes = await docClient.send(new QueryCommand({
      TableName: TableNames.Wheels,
      IndexName: "OwnerIdIndex",
      KeyConditionExpression: "ownerId = :uid",
      ExpressionAttributeValues: { ":uid": userId },
    }));
    const ownedWheels = wheelRes.Items || [];

    for (const wheel of ownedWheels) {
      await docClient.send(new DeleteCommand({
        TableName: TableNames.Wheels,
        Key: { PK: wheel.PK }
      }));
    }

    // 2. Remove user from collaborator and viewer lists on other wheels
    const allWheelsRes = await docClient.send(new ScanCommand({
      TableName: TableNames.Wheels,
    }));
    const allWheels = allWheelsRes.Items || [];
    for (const w of allWheels) {
      const hasCollab = Array.isArray(w.collaborators) && w.collaborators.includes(userId);
      const hasViewer = Array.isArray(w.viewers) && w.viewers.includes(userId);
      if (hasCollab || hasViewer) {
        const newCollabs = (w.collaborators || []).filter((id) => id !== userId);
        const newViewers = (w.viewers || []).filter((id) => id !== userId);
        await docClient.send(new UpdateCommand({
          TableName: TableNames.Wheels,
          Key: { PK: w.PK },
          UpdateExpression: "SET collaborators = :c, viewers = :v",
          ExpressionAttributeValues: {
            ":c": newCollabs,
            ":v": newViewers,
          },
        }));
      }
    }

    // 3. Delete the main user record
    await docClient.send(new DeleteCommand({
      TableName: TableNames.Users,
      Key: { PK: `USER#${userId}` }
    }));

    // 3. Delete the username pointer record
    if (username) {
      await docClient.send(new DeleteCommand({
        TableName: TableNames.Users,
        Key: { PK: `USER#USERNAME#${username.toLowerCase()}` }
      }));
    }

    // 4. Log the deletion for compliance
    console.info(JSON.stringify({
      event: "ACCOUNT_DELETED",
      userId: userId,
      username: username,
      wheelsDeleted: ownedWheels.length,
      timestamp: new Date().toISOString()
    }));

    // 5. Send confirmation email
    if (email) {
      await sendEmail({
        to: email,
        subject: "Account Deletion Confirmation",
        text: `Hello ${username || ''},\n\nThis is a confirmation that your account and all associated data have been permanently deleted from Spin the Wheel!\n\nIf you did not request this, please contact support immediately.`,
        html: `<p>Hello ${escapeHtml(username || '')},</p><p>This is a confirmation that your account and all associated data have been permanently deleted from <strong>Spin the Wheel!</strong></p><p>If you did not request this, please contact support immediately.</p>`,
      });
    }

    // 6. Clear cookie and logout
    const response = NextResponse.json({ success: true, message: "Account and associated data successfully deleted." });
    response.cookies.set({
      name: "auth_token",
      value: "",
      httpOnly: true,
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error("Account deletion error:", error);
    return NextResponse.json({ error: "Internal server error during account deletion" }, { status: 500 });
  }
}
