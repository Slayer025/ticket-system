const {
  DynamoDBClient,
  QueryCommand,
  BatchWriteItemCommand,
  PutItemCommand,
} = require("@aws-sdk/client-dynamodb");

const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");
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

    let items = [];
    let ExclusiveStartKey;

    do {
      const result = await db.send(
        new QueryCommand({
          TableName: process.env.TABLE_NAME,
          KeyConditionExpression: "PK = :pk",
          ExpressionAttributeValues: marshall({
            ":pk": pk,
          }),
          ExclusiveStartKey,
        })
      );

      if (result.Items) items.push(...result.Items);
      ExclusiveStartKey = result.LastEvaluatedKey;
    } while (ExclusiveStartKey);

    if (!items.length) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Ticket not found" }),
      };
    }

    const parsed = items.map(unmarshall);
    const metadata = parsed.find((i) => i.SK === "METADATA");

    const now = new Date().toISOString();

    // DELETE ALL ITEMS
    let deleteRequests = items.map((item) => ({
      DeleteRequest: {
        Key: marshall({
          PK: item.PK,
          SK: item.SK,
        }),
      },
    }));

    while (deleteRequests.length) {
      const batch = deleteRequests.splice(0, 25);

      await db.send(
        new BatchWriteItemCommand({
          RequestItems: {
            [process.env.TABLE_NAME]: batch,
          },
        })
      );
    }

    // EVENT LOG
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
          actor: "agent",

          previous_value: metadata || null,
          new_value: null,
        }),
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