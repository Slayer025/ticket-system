const { DynamoDBClient, ScanCommand } = require("@aws-sdk/client-dynamodb");
const { unmarshall } = require("@aws-sdk/util-dynamodb");
const { getUserFromEvent } = require("./auth");

const db = new DynamoDBClient({});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

// =========================
// SAFE SCAN HELPER
// =========================
const scanAll = async (params) => {
  let items = [];
  let ExclusiveStartKey;

  do {
    const result = await db.send(
      new ScanCommand({
        ...params,
        ExclusiveStartKey,
      })
    );

    if (result.Items) {
      items.push(...result.Items.map(unmarshall));
    }

    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  return items;
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
    // FETCH ALL TICKETS
    // ======================
    // Only fetch rows that have ticket_id, title, and description
    const baseFilter = {
      TableName: process.env.TABLE_NAME,
      FilterExpression:
        "attribute_exists(ticket_id) AND attribute_exists(title) AND attribute_exists(description)",
    };

    let items = await scanAll(baseFilter);

    // ======================
    // ROLE FILTERING
    // ======================
    if (user.role === "USER") {
      // USER only sees their own tickets
      items = items.filter((t) => t.requester_id === user.user_id);
    }

    // AGENT and ADMIN see all tickets → no filtering

    // ======================
    // SANITIZE ITEMS FOR FRONTEND
    // ======================
    items = items.map((t) => ({
      ticket_id: t.ticket_id,
      title: t.title || "",
      description: t.description || "",
      team: t.team || "-",
      priority: t.priority || "P3",
      status: t.status || "NEW",
      owner: t.owner || "UNASSIGNED",
      requester_id: t.requester_id || "",
    }));

    // ======================
    // RESPONSE
    // ======================
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(items),
    };
  } catch (err) {
    console.error("GET TICKETS ERROR:", err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message }),
    };
  }
};