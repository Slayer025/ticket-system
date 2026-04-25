const {
  DynamoDBClient,
  UpdateItemCommand,
  PutItemCommand,
  GetItemCommand,
} = require("@aws-sdk/client-dynamodb");

const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");
const crypto = require("crypto");

const db = new DynamoDBClient({});

exports.handler = async (event) => {
  for (const record of event.Records || []) {
    try {
      const data = JSON.parse(record.body);

      if (!data.ticket_id) continue;

      const key = {
        PK: `TICKET#${data.ticket_id}`,
        SK: "METADATA",
      };

      const oldRes = await db.send(new GetItemCommand({
        TableName: process.env.TABLE_NAME,
        Key: marshall(key),
      }));

      const oldItem = oldRes.Item ? unmarshall(oldRes.Item) : {};

      const category = data.description?.includes("error")
        ? "INCIDENT"
        : "SERVICE_REQUEST";

      const priority = data.urgency === "HIGH" ? "P1" : "P3";

      const owner =
        data.team === "IT" ? "it_agent" :
        data.team === "HR" ? "hr_agent" :
        "general_agent";

      const now = new Date().toISOString();
      const sla_due_at = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();

      await db.send(new UpdateItemCommand({
        TableName: process.env.TABLE_NAME,
        Key: marshall(key),
        UpdateExpression:
          "SET category=:c, priority=:p, owner=:o, sla_due_at=:s, #st=:st, updated_at=:u",
        ExpressionAttributeNames: { "#st": "status" },
        ExpressionAttributeValues: marshall({
          ":c": category,
          ":p": priority,
          ":o": owner,
          ":s": sla_due_at,
          ":st": "TRIAGED",
          ":u": now,
        }),
      }));

      await db.send(new PutItemCommand({
        TableName: process.env.TABLE_NAME,
        Item: marshall({
          PK: key.PK,
          SK: `EVENT#${Date.now()}#${crypto.randomBytes(3).toString("hex")}`,
          event_id: crypto.randomUUID(),
          ticket_id: data.ticket_id,
          event_type: "TRIAGED",
          event_timestamp: now,
          actor: "system",
          previous_value: oldItem,
          new_value: { status: "TRIAGED", priority, category, owner },
        }),
      }));

    } catch (err) {
      console.error("TRIAGE ERROR:", err);
    }
  }
};