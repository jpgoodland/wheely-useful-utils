import { DynamoDBClient, CreateTableCommand, ListTablesCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000',
  credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "fakeMyKeyId",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "fakeSecretAccessKey",
  }
});

const TableNames = {
  Users: "WheelApp_Users",
  Wheels: "WheelApp_Wheels",
};

async function init() {
  const { TableNames: existingTables } = await client.send(new ListTablesCommand({}));

  if (!existingTables.includes(TableNames.Users)) {
    console.log(`Creating ${TableNames.Users}...`);
    await client.send(new CreateTableCommand({
      TableName: TableNames.Users,
      AttributeDefinitions: [
        { AttributeName: "PK", AttributeType: "S" },
        { AttributeName: "EmailOrUsername", AttributeType: "S" } // For LSI/GSI if we want fast lookup, but we can just use PK=USER#email
      ],
      KeySchema: [
        { AttributeName: "PK", KeyType: "HASH" } // PK: USER#<email_or_something> 
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: "EmailOrUsernameIndex",
          KeySchema: [
            { AttributeName: "EmailOrUsername", KeyType: "HASH" }
          ],
          Projection: { ProjectionType: "ALL" },
          ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
        }
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5,
      }
    }));
  }

  if (!existingTables.includes(TableNames.Wheels)) {
    console.log(`Creating ${TableNames.Wheels}...`);
    await client.send(new CreateTableCommand({
      TableName: TableNames.Wheels,
      AttributeDefinitions: [
        { AttributeName: "PK", AttributeType: "S" }, // WHEEL#<id>
        { AttributeName: "ownerId", AttributeType: "S" }, // M4: for OwnerIdIndex GSI
      ],
      KeySchema: [
        { AttributeName: "PK", KeyType: "HASH" }
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: "OwnerIdIndex",
          KeySchema: [
            { AttributeName: "ownerId", KeyType: "HASH" }
          ],
          Projection: { ProjectionType: "ALL" },
          ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
        }
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5,
      }
    }));
  }

  console.log("Database initialized.");
}

init().catch(console.error);
