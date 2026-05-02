const { DynamoDBClient, QueryCommand } = require("@aws-sdk/client-dynamodb");
const { unmarshall, marshall } = require("@aws-sdk/util-dynamodb");

const db = new DynamoDBClient({});

const { getUserFromEvent } = require("./auth");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
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
    // FETCH TICKET
    // ======================
    const result = await db.send(
      new QueryCommand({
        TableName: process.env.TABLE_NAME,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: marshall({
          ":pk": pk,
        }),
      })
    );

    const items = (result.Items || []).map(unmarshall);

    const metadata = items.find((i) => i.SK === "METADATA");

    if (!metadata) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Ticket not found" }),
      };
    }

    // ======================
    // ACCESS CONTROL
    // ======================
    const isOwner = metadata.requester_id === user.user_id;
    const isAdmin = user.role === "ADMIN";
    const isAgent = user.role === "AGENT";

    // RULE:
    // USER → only own ticket
    // AGENT → all tickets (view only)
    // ADMIN → all tickets

    if (!isOwner && !isAdmin && !isAgent) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Forbidden" }),
      };
    }

    // Optional future rule (recommended later):
    // if (isAgent && metadata.status === "RESOLVED") restrict view

    // ======================
    // EVENTS
    // ======================
    const events = items
      .filter((i) => i.SK.startsWith("EVENT#"))
      .sort((a, b) => b.SK.localeCompare(a.SK));

    // ======================
    // RESPONSE
    // ======================
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        ticket: metadata,
        events,
      }),
    };
  } catch (err) {
    console.error("GET BY ID ERROR:", err);

    return {
      statusCode:
        err.message === "Unauthorized" || err.message === "Invalid token"
          ? 401
          : 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message }),
    };
  }
};