const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");
const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");
const { marshall } = require("@aws-sdk/util-dynamodb");
const crypto = require("crypto");

const db = new DynamoDBClient({});
const sqs = new SQSClient({});

const TABLE_NAME = process.env.TABLE_NAME;
const QUEUE_URL = process.env.QUEUE_URL;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const getPriority = (urgency) => {
  if (urgency === "HIGH") return "P1";
  if (urgency === "MEDIUM") return "P2";
  return "P3";
};

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: corsHeaders };
    }

    let body = {};
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Invalid JSON" }),
      };
    }

    if (!body.title || !body.description || !body.requester) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Missing required fields" }),
      };
    }

    const ticketId = crypto.randomUUID();
    const now = new Date().toISOString();
    const sla_due_at = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();

    const ticket = {
      PK: `TICKET#${ticketId}`,
      SK: "METADATA",
      ticket_id: ticketId,
      title: body.title,
      description: body.description,
      requester: body.requester,
      team: body.team || "GENERAL",
      status: "NEW",
      priority: getPriority(body.urgency),
      owner: "UNASSIGNED",
      sla_state: "ON_TRACK",
      sla_due_at,
      created_at: now,
      updated_at: now,
    };

    await db.send(new PutItemCommand({
      TableName: TABLE_NAME,
      Item: marshall(ticket),
    }));

    // ✅ DO NOT FAIL REQUEST IF SQS FAILS
    try {
      await sqs.send(new SendMessageCommand({
        QueueUrl: QUEUE_URL,
        MessageBody: JSON.stringify({
          ticket_id: ticketId,
          urgency: body.urgency || "LOW",
          team: body.team || "GENERAL",
          description: body.description || ""
        }),
      }));
    } catch (e) {
      console.error("SQS ERROR:", e);
    }

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
    console.error("CREATE ERROR:", err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message }),
    };
  }
};