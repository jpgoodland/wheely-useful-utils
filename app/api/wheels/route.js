import { NextResponse } from "next/server";
import { docClient, TableNames } from "@/lib/dynamodb";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getSession } from "@/lib/session";
import crypto from "crypto";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // M4: Query by ownerId GSI instead of full-table Scan
    const ownedWheels = await docClient.send(new QueryCommand({
      TableName: TableNames.Wheels,
      IndexName: "OwnerIdIndex",
      KeyConditionExpression: "ownerId = :uid",
      ExpressionAttributeValues: { ":uid": session.userId },
    }));

    // TODO: shared wheels (collaborator/viewer) would need a separate
    // GSI or Scan — for now we return owned wheels only. A future
    // improvement could store membership items keyed by userId.
    const userWheels = ownedWheels.Items || [];

    return NextResponse.json(userWheels);
  } catch (error) {
    console.error("GET wheels error", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { name, categories } = await req.json();

    if (!name || typeof name !== "string" || name.trim().length === 0 || name.trim().length > 100) {
      return NextResponse.json({ error: "Wheel name must be between 1 and 100 characters" }, { status: 400 });
    }

    if (!categories || !Array.isArray(categories) || categories.length > 50) {
      return NextResponse.json({ error: "Categories must be an array with up to 50 items" }, { status: 400 });
    }

    const invalidCategory = categories.find(c => {
      if (!c || typeof c !== "object") return true;
      if (c.name && (typeof c.name !== "string" || c.name.length > 50)) return true;
      if (typeof c.weight !== "undefined" && (!Number.isFinite(c.weight) || c.weight <= 0 || c.weight > 10000)) return true;
      if (c.color && (typeof c.color !== "string" || c.color.length > 30)) return true;
      return false;
    });
    if (invalidCategory) {
      return NextResponse.json({ error: "Invalid category: name must be <= 50 chars, weight must be a positive number up to 10000" }, { status: 400 });
    }

    // M4: Query by ownerId GSI instead of full-table Scan
    const ownedRes = await docClient.send(new QueryCommand({
      TableName: TableNames.Wheels,
      IndexName: "OwnerIdIndex",
      KeyConditionExpression: "ownerId = :uid",
      ExpressionAttributeValues: { ":uid": session.userId },
      Select: "COUNT",
    }));

    const wheelCount = ownedRes.Count ?? (ownedRes.Items ? ownedRes.Items.length : 0);
    if (wheelCount >= 25) {
      return NextResponse.json({ error: "Maximum of 25 wheels reached" }, { status: 403 });
    }

    const wheelId = crypto.randomUUID();
    
    // categories must possess a weight.
    const processedCategories = categories.map((c, i) => ({
      id: crypto.randomUUID(),
      name: c.name || `Category ${i+1}`,
      weight: c.weight || 10,
      color: c.color || '#ffffff'
    }));

    const wheelItem = {
      PK: `WHEEL#${wheelId}`,
      wheelId,
      name,
      ownerId: session.userId,
      collaborators: [],
      viewers: [],
      categories: processedCategories,
      createdAt: new Date().toISOString()
    };

    await docClient.send(new PutCommand({
      TableName: TableNames.Wheels,
      Item: wheelItem
    }));

    return NextResponse.json(wheelItem);
  } catch(e) {
    console.error("POST wheels error", e);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
