const {
  DynamoDBClient,
  QueryCommand,
  DeleteItemCommand,
  PutItemCommand,
} = require("@aws-sdk/client-dynamodb");

const { unmarshall } = require("@aws-sdk/util-dynamodb");
const crypto = require("crypto");

const db = new DynamoDBClient({});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: corsHeaders };
    }

    const id = event.pathParameters?.id;

    if (!id) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Missing ticket id" }),
      };
    }

    const pk = `TICKET#${id}`;

    // =========================
    // QUERY
    // =========================
    const result = await db.send(
      new QueryCommand({
        TableName: process.env.TABLE_NAME,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: {
          ":pk": { S: pk },   // 🔥 IMPORTANT FIX (NO marshall)
        },
      })
    );

    const items = result.Items || [];

    if (!items.length) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Ticket not found" }),
      };
    }

    const parsed = items.map(unmarshall);
    const metadata = parsed.find(i => i.SK === "METADATA");

    // =========================
    // DELETE (FIXED)
    // =========================
    for (const item of parsed) {
      if (!item.PK || !item.SK) continue;

      await db.send(
        new DeleteItemCommand({
          TableName: process.env.TABLE_NAME,
          Key: {
            PK: { S: String(item.PK) },
            SK: { S: String(item.SK) },
          },
        })
      );
    }

    // =========================
    // EVENT LOG
    // =========================
    await db.send(
      new PutItemCommand({
        TableName: process.env.TABLE_NAME,
        Item: {
          PK: { S: pk },
          SK: { S: `EVENT#${Date.now()}#${crypto.randomBytes(3).toString("hex")}` },
          event_id: { S: crypto.randomUUID() },
          ticket_id: { S: id },
          event_type: { S: "DELETED" },
          event_timestamp: { S: new Date().toISOString() },
          actor: { S: "agent" },
        },
      })
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: "Ticket deleted successfully" }),
    };

  } catch (err) {
    console.error("DELETE error:", err);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message }),
    };
  }
};