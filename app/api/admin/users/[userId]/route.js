import { NextResponse } from "next/server";
import { docClient, TableNames } from "@/lib/dynamodb";
import { GetCommand, DeleteCommand, UpdateCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { getSession } from "@/lib/session";
import bcrypt from "bcrypt";
import { validatePassword } from "@/lib/password";

async function requireAdmin() {
  const session = await getSession();
  if (!session) return null;
  if (!session.isAdmin) return null;
  return session;
}

// DELETE /api/admin/users/[userId] — delete a user and their username pointer
export async function DELETE(req, { params }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await params;

  // Prevent admins from deleting themselves
  if (userId === session.userId) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  const { Item: user } = await docClient.send(new GetCommand({
    TableName: TableNames.Users,
    Key: { PK: `USER#${userId}` },
  }));

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Delete wheels owned by the user
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
      Key: { PK: wheel.PK },
    }));
  }

  // Remove user from collaborator and viewer lists on other wheels
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

  await docClient.send(new DeleteCommand({
    TableName: TableNames.Users,
    Key: { PK: `USER#${userId}` },
  }));

  // Also remove the username pointer item
  if (user.username) {
    await docClient.send(new DeleteCommand({
      TableName: TableNames.Users,
      Key: { PK: `USER#USERNAME#${user.username}` },
    }));
  }

  return NextResponse.json({ success: true });
}

// PATCH /api/admin/users/[userId] — update user fields (isAdmin, password reset)
export async function PATCH(req, { params }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await params;
  const body = await req.json();
  const { isAdmin, newPassword } = body;

  // Must provide at least one field to update
  if (typeof isAdmin === "undefined" && !newPassword) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  // Prevent admins from removing their own admin role
  if (typeof isAdmin === "boolean" && userId === session.userId && !isAdmin) {
    return NextResponse.json({ error: "Cannot remove your own admin role" }, { status: 400 });
  }

  const { Item: user } = await docClient.send(new GetCommand({
    TableName: TableNames.Users,
    Key: { PK: `USER#${userId}` },
  }));

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Build dynamic update expression
  const exprParts = [];
  const exprValues = {};

  if (typeof isAdmin === "boolean") {
    exprParts.push("isAdmin = :isAdmin");
    exprValues[":isAdmin"] = isAdmin;
  }

  if (newPassword) {
    const { valid: pwValid, errors: pwErrors } = validatePassword(newPassword);
    if (!pwValid) {
      return NextResponse.json(
        { error: "Password does not meet requirements: " + pwErrors.join("; ") },
        { status: 400 }
      );
    }
    const hashed = await bcrypt.hash(newPassword, 10);
    exprParts.push("password = :pw");
    exprValues[":pw"] = hashed;
  }

  const updateExpr = "SET " + exprParts.join(", ");

  // Update primary item
  await docClient.send(new UpdateCommand({
    TableName: TableNames.Users,
    Key: { PK: `USER#${userId}` },
    UpdateExpression: updateExpr,
    ExpressionAttributeValues: exprValues,
  }));

  // Mirror to username pointer item
  if (user.username) {
    await docClient.send(new UpdateCommand({
      TableName: TableNames.Users,
      Key: { PK: `USER#USERNAME#${user.username}` },
      UpdateExpression: updateExpr,
      ExpressionAttributeValues: exprValues,
    }));
  }

  return NextResponse.json({
    success: true,
    userId,
    ...(typeof isAdmin === "boolean" ? { isAdmin } : {}),
    ...(newPassword ? { passwordReset: true } : {}),
  });
}
