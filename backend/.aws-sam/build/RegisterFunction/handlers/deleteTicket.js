const {
  DynamoDBClient,
  QueryCommand,
  DeleteItemCommand,
  PutItemCommand,
} = require("@aws-sdk/client-dynamodb");

const { unmarshall, marshall } = require("@aws-sdk/util-dynamodb");
const crypto = require("crypto");

const db = new DynamoDBClient({});

const { getUserFromEvent } = require("./auth");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

exports.handler = async (event) => {
  try {
    // ======================
    // CORS
    // ======================
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: corsHeaders };
    }

    // ======================
    // AUTH
    // ======================
    let user;
    try {
      user = getUserFromEvent(event);
    } catch (err) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: err.message }),
      };
    }

    // ======================
    // ROLE CHECK (FIXED)
    // ======================
    // ADMIN + AGENT can delete
    if (!["ADMIN", "AGENT"].includes(user.role)) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "Only ADMIN or AGENT can delete tickets",
        }),
      };
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

    // ======================
    // FETCH TICKET ITEMS
    // ======================
    const result = await db.send(
      new QueryCommand({
        TableName: process.env.TABLE_NAME,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: {
          ":pk": { S: pk },   // ✅ FIXED (no marshall here)
        },
      })
    );

    const items = result.Items || [];

    if (items.length === 0) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Ticket not found" }),
      };
    }

    const parsed = items.map(unmarshall);

    // ======================
    // DELETE ALL RELATED ITEMS
    // ======================
    for (const item of parsed) {
      if (!item.PK || !item.SK) continue;

      await db.send(
        new DeleteItemCommand({
          TableName: process.env.TABLE_NAME,
          Key: {
            PK: { S: item.PK },
            SK: { S: item.SK },
          },
        })
      );
    }

    const now = new Date().toISOString();

    // ======================
    // EVENT LOG
    // ======================
    await db.send(
      new PutItemCommand({
        TableName: process.env.TABLE_NAME,
        Item: marshall({
          PK: pk,
          SK: `EVENT#${Date.now()}#${crypto.randomBytes(3).toString("hex")}`,
          event_id: crypto.randomUUID(),
          ticket_id: id,
          event_type: "DELETED",
          event_timestamp: now,
          actor: user.user_id,
        }),
      })
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: "Ticket deleted successfully",
      }),
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