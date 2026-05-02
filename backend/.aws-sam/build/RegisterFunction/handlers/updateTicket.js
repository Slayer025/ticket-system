const {
  DynamoDBClient,
  UpdateItemCommand,
  PutItemCommand,
  GetItemCommand,
} = require("@aws-sdk/client-dynamodb");

const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");
const crypto = require("crypto");

const { getUserFromEvent } = require("./auth");

const db = new DynamoDBClient({});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

// ✅ VALID STATUS FLOW
const allowedTransitions = {
  NEW: ["TRIAGED"],
  TRIAGED: ["IN_PROGRESS"],
  IN_PROGRESS: ["RESOLVED"],
  RESOLVED: [],
};

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: corsHeaders };
    }

    // 🔐 AUTH
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

    const id = event.pathParameters?.id;

    if (!id) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Missing ticket id" }),
      };
    }

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

    const key = {
      PK: `TICKET#${id}`,
      SK: "METADATA",
    };

    // =====================
    // GET EXISTING TICKET
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

    // =====================
    // AUTHORIZATION
    // =====================
    const isOwner = oldItem.requester_id === user.user_id;
    const isAdmin = user.role === "ADMIN";
    const isAgent = user.role === "AGENT";

    if (!isOwner && !isAdmin && !isAgent) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Forbidden" }),
      };
    }

    // ❌ BLOCK IF RESOLVED
    if (oldItem.status === "RESOLVED") {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Cannot update resolved ticket" }),
      };
    }

    const now = new Date().toISOString();

    let updateExp = [];
    let values = {};
    let names = {};
    let changes = {};

    // =====================
    // STATUS UPDATE (FLOW CONTROL)
    // =====================
    if (body.status && body.status !== oldItem.status) {
      const allowed = allowedTransitions[oldItem.status] || [];

      if (!allowed.includes(body.status)) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            error: `Invalid transition from ${oldItem.status} to ${body.status}`,
          }),
        };
      }

      updateExp.push("#st = :st");
      values[":st"] = body.status;
      names["#st"] = "status";

      changes.status = {
        from: oldItem.status,
        to: body.status,
      };

      // SLA completion
      if (body.status === "RESOLVED") {
        updateExp.push("sla_state = :sla");
        values[":sla"] = "COMPLETED";
      }
    }

    // =====================
    // OWNER CHANGE
    // =====================
    if (body.owner && body.owner !== oldItem.owner) {
      if (!isAgent && !isAdmin) {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({
            error: "Only AGENT or ADMIN can assign owner",
          }),
        };
      }

      updateExp.push("#own = :o");
      values[":o"] = body.owner;
      names["#own"] = "owner";

      changes.owner = {
        from: oldItem.owner,
        to: body.owner,
      };
    }

    // =====================
    // PRIORITY CHANGE
    // =====================
    if (body.priority && body.priority !== oldItem.priority) {
      if (!isAgent && !isAdmin) {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({
            error: "Only AGENT or ADMIN can change priority",
          }),
        };
      }

      updateExp.push("#pr = :p");
      values[":p"] = body.priority;
      names["#pr"] = "priority";

      changes.priority = {
        from: oldItem.priority,
        to: body.priority,
      };
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
    // SAFE EVENT LOG
    // =====================
    const previous_value = {};
    const new_value = {};

    for (const k of Object.keys(changes)) {
      previous_value[k] = changes[k].from;
      new_value[k] = changes[k].to;
    }

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

          actor: user.user_id,

          previous_value,
          new_value,
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