const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");
const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");
const { marshall } = require("@aws-sdk/util-dynamodb");
const crypto = require("crypto");

const { getUserFromEvent } = require("./auth");

const db = new DynamoDBClient({});
const sqs = new SQSClient({});

const TABLE_NAME = process.env.TABLE_NAME;
const QUEUE_URL = process.env.QUEUE_URL;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

// =====================
// PRIORITY ENGINE
// =====================
const getPriority = (urgency) => {
  const u = (urgency || "").toUpperCase();

  if (u === "HIGH") return "P1";
  if (u === "MEDIUM") return "P2";
  return "P3";
};

exports.handler = async (event) => {
  try {
    // =====================
    // CORS HANDLING
    // =====================
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: corsHeaders };
    }

    // =====================
    // AUTH
    // =====================
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

    // =====================
    // PARSE REQUEST BODY
    // =====================
    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Invalid JSON" }),
      };
    }

    // =====================
    // VALIDATION
    // =====================
    if (!body.title || !body.description) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "title and description are required",
        }),
      };
    }

    // =====================
    // CREATE TICKET
    // =====================
    const ticketId = crypto.randomUUID();
    const now = new Date().toISOString();

    const sla_due_at = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();

    const ticket = {
      PK: `TICKET#${ticketId}`,
      SK: "METADATA",

      ticket_id: ticketId,
      title: body.title,
      description: body.description,

      requester_id: user.user_id,

      team: body.team || "GENERAL",
      status: "NEW",
      priority: getPriority(body.urgency),
      owner: "UNASSIGNED",

      sla_state: "ON_TRACK",
      sla_due_at,

      created_at: now,
      updated_at: now,
    };

    // =====================
    // SAVE TO DYNAMODB
    // =====================
    await db.send(
      new PutItemCommand({
        TableName: TABLE_NAME,
        Item: marshall(ticket),
      })
    );

    // =====================
    // SEND TO SQS (NON-BLOCKING)
    // =====================
    try {
      await sqs.send(
        new SendMessageCommand({
          QueueUrl: QUEUE_URL,
          MessageBody: JSON.stringify({
            ticket_id: ticketId,
            urgency: body.urgency || "LOW",
            team: body.team || "GENERAL",
            description: body.description,
          }),
        })
      );
    } catch (err) {
      console.error("SQS ERROR (non-fatal):", err);
    }

    // =====================
    // RESPONSE
    // =====================
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        ticket_id: ticketId,
        status: "NEW",
        priority: ticket.priority,
      }),
    };
  } catch (err) {
    console.error("CREATE TICKET ERROR:", err);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message }),
    };
  }
};