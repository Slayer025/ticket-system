const {
  DynamoDBClient,
  UpdateItemCommand,
  PutItemCommand,
  GetItemCommand,
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

    let body = {};
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Invalid JSON" }),
      };
    }

    if (!id) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Missing ticket id" }),
      };
    }

    const key = {
      PK: `TICKET#${id}`,
      SK: "METADATA",
    };

    // =====================
    // GET EXISTING ITEM
    // =====================
    const oldRes = await db.send(
      new GetItemCommand({
        TableName: process.env.TABLE_NAME,
        Key: marshall(key),
      })
    );

    if (!oldRes.Item) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Ticket not found" }),
      };
    }

    const oldItem = unmarshall(oldRes.Item);

    const now = new Date().toISOString();

    let updateExp = [];
    let values = {};
    let names = {};
    let changes = {};

    // =====================
    // STATUS (reserved word)
    // =====================
    if (body.status && body.status !== oldItem.status) {
      updateExp.push("#st = :st");
      values[":st"] = body.status;
      names["#st"] = "status";

      changes.status = { from: oldItem.status, to: body.status };
    }

    // =====================
    // OWNER (reserved word FIXED)
    // =====================
    if (body.owner && body.owner !== oldItem.owner) {
      updateExp.push("#own = :o");
      values[":o"] = body.owner;
      names["#own"] = "owner";

      changes.owner = { from: oldItem.owner, to: body.owner };
    }

    // =====================
    // PRIORITY
    // =====================
    if (body.priority && body.priority !== oldItem.priority) {
      updateExp.push("#pr = :p");
      values[":p"] = body.priority;
      names["#pr"] = "priority";

      changes.priority = { from: oldItem.priority, to: body.priority };
    }

    if (updateExp.length === 0) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "No valid fields to update" }),
      };
    }

    updateExp.push("#upd = :u");
    values[":u"] = now;
    names["#upd"] = "updated_at";

    // =====================
    // UPDATE ITEM
    // =====================
    await db.send(
      new UpdateItemCommand({
        TableName: process.env.TABLE_NAME,
        Key: marshall(key),
        UpdateExpression: `SET ${updateExp.join(", ")}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: marshall(values),
      })
    );

    // =====================
    // EVENT LOG
    // =====================
    await db.send(
      new PutItemCommand({
        TableName: process.env.TABLE_NAME,
        Item: marshall({
          PK: key.PK,
          SK: `EVENT#${Date.now()}#${crypto.randomBytes(3).toString("hex")}`,

          event_id: crypto.randomUUID(),
          ticket_id: id,
          event_type: "UPDATED",
          event_timestamp: now,
          actor: "agent",

          previous_value: Object.keys(changes).length
            ? Object.fromEntries(
                Object.entries(changes).map(([k, v]) => [k, v.from])
              )
            : null,

          new_value: Object.keys(changes).length
            ? Object.fromEntries(
                Object.entries(changes).map(([k, v]) => [k, v.to])
              )
            : null,
        }),
      })
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: "Updated successfully",
        changes,
      }),
    };

  } catch (err) {
    console.error("UPDATE error:", err);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message }),
    };
  }
};