const { DynamoDBClient, ScanCommand } = require("@aws-sdk/client-dynamodb");
const { unmarshall } = require("@aws-sdk/util-dynamodb");

const db = new DynamoDBClient({});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return {
        statusCode: 200,
        headers: corsHeaders,
      };
    }

    // ======================
    // FULL SCAN (SAFE VERSION)
    // ======================
    const result = await db.send(
      new ScanCommand({
        TableName: process.env.TABLE_NAME,
      })
    );

    const rawItems = result.Items || [];
    const items = rawItems.map(unmarshall);

    // ======================
    // FILTER ONLY TICKETS
    // ======================
    const tickets = items.filter(
      (i) => i.SK === "METADATA"
    );

    // ======================
    // SAFE DEFAULTS
    // ======================
    const safeStatus = (s) => s || "UNKNOWN";
    const safeSLA = (s) => s || "ON_TRACK";

    // ======================
    // SUMMARY CALCULATION
    // ======================
    const summary = {
      open: tickets.filter(
        (i) => safeStatus(i.status) !== "RESOLVED"
      ).length,

      breached: tickets.filter(
        (i) => safeSLA(i.sla_state) === "BREACHED"
      ).length,

      at_risk: tickets.filter(
        (i) => safeSLA(i.sla_state) === "AT_RISK"
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