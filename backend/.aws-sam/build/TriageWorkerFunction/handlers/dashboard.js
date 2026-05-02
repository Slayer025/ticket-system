const { DynamoDBClient, ScanCommand } = require("@aws-sdk/client-dynamodb");
const { unmarshall } = require("@aws-sdk/util-dynamodb");

const db = new DynamoDBClient({});

const { getUserFromEvent } = require("./auth");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

// ======================
// HELPERS
// ======================
const safeStatus = (s) => s || "UNKNOWN";
const safeSLA = (s) => s || "ON_TRACK";

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
    // PAGINATED SCAN (FIXED)
    // ======================
    let items = [];
    let ExclusiveStartKey;

    do {
      const result = await db.send(
        new ScanCommand({
          TableName: process.env.TABLE_NAME,
          ExclusiveStartKey,
        })
      );

      if (result.Items) {
        items.push(...result.Items.map(unmarshall));
      }

      ExclusiveStartKey = result.LastEvaluatedKey;
    } while (ExclusiveStartKey);

    // ======================
    // FILTER TICKETS ONLY
    // ======================
    let tickets = items.filter((i) => i.SK === "METADATA");

    // ======================
    // ROLE-BASED FILTERING
    // ======================
    if (user.role === "USER") {
      tickets = tickets.filter(
        (t) => t.requester_id === user.user_id
      );
    }

    // AGENT → sees all tickets (future: assigned only)
    // ADMIN → sees all tickets

    // ======================
    // DASHBOARD STATS
    // ======================
    const summary = {
      open: tickets.filter(
        (i) => safeStatus(i.status) !== "RESOLVED"
      ).length,

      at_risk: tickets.filter(
        (i) => safeSLA(i.sla_state) === "AT_RISK"
      ).length,

      breached: tickets.filter(
        (i) => safeSLA(i.sla_state) === "BREACHED"
      ).length,
    };

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(summary),
    };
  } catch (err) {
    console.error("Dashboard error:", err);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message }),
    };
  }
};