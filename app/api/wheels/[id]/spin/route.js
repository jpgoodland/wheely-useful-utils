import { NextResponse } from "next/server";
import { docClient, TableNames } from "@/lib/dynamodb";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { getSession } from "@/lib/session";
import crypto from "crypto";

/**
 * Cryptographically secure pseudo-random float in [0, 1).
 * Uses 48 bits of entropy from crypto.randomBytes to avoid PRNG predictability.
 */
function secureRandomFloat() {
  const buf = crypto.randomBytes(6);
  const intVal = buf.readUIntBE(0, 6);
  return intVal / 0x1000000000000;
}

export async function POST(req, { params }) {
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

    if (wheel.ownerId !== session.userId && !wheel.collaborators?.includes(session.userId) && !wheel.viewers?.includes(session.userId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let categories = wheel.categories || [];
    if (categories.length === 0) {
      return NextResponse.json({ error: "No categories to spin" }, { status: 400 });
    }
    
    if (categories.length === 1) {
        return NextResponse.json({ winners: [categories[0]], newCategories: categories });
    }

    let body = {};
    try { body = await req.json(); } catch(e) {}
    const count = Math.min(Math.max(body.count || 1, 1), 100);

    const winners = [];
    let currentCategories = [...categories];

    for (let c = 0; c < count; c++) {
        const totalWeight = currentCategories.reduce((sum, cat) => sum + cat.weight, 0);
        let rand = secureRandomFloat() * totalWeight;

        let winnerIdx = -1;
        for (let i = 0; i < currentCategories.length; i++) {
            if (rand < currentCategories[i].weight) {
                winnerIdx = i;
                break;
            }
            rand -= currentCategories[i].weight;
        }

        if (winnerIdx === -1) winnerIdx = currentCategories.length - 1;

        const N = currentCategories.length;
        const winner = currentCategories[winnerIdx];
        winners.push(winner);
        
        const weightDrop = winner.weight / N;
        const additionToOthers = weightDrop / (N - 1);

        currentCategories = currentCategories.map((cat, i) => {
            if (i === winnerIdx) {
                return { 
                    ...cat, 
                    weight: Math.max(0, cat.weight - weightDrop),
                    selectedCount: (cat.selectedCount || 0) + 1 
                };
            } else {
                return { ...cat, weight: cat.weight + additionToOthers };
            }
        });
    }

    await docClient.send(new UpdateCommand({
        TableName: TableNames.Wheels,
        Key: { PK: `WHEEL#${id}` },
        UpdateExpression: "SET categories = :c",
        ExpressionAttributeValues: { ":c": currentCategories }
    }));

    return NextResponse.json({ winners, newCategories: currentCategories });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
