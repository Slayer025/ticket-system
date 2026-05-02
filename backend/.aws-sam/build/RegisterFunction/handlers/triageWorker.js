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

      // ======================
      // GET EXISTING TICKET
      // ======================
      const oldRes = await db.send(
        new GetItemCommand({
          TableName: process.env.TABLE_NAME,
          Key: marshall(key),
        })
      );

      if (!oldRes.Item) {
        console.log("Ticket not found, skipping:", data.ticket_id);
        continue;
      }

      const oldItem = unmarshall(oldRes.Item);

      // ======================
      // 🛑 SKIP IF ALREADY TRIAGED
      // ======================
      if (oldItem.status === "TRIAGED") continue;

      // ======================
      // 🛑 SKIP IF RESOLVED (edge case)
      // ======================
      if (oldItem.status === "RESOLVED") continue;

      // ======================
      // BETTER CLASSIFICATION
      // ======================
      const text = (data.description || "").toLowerCase();

      let category = "SERVICE_REQUEST";

      if (
        text.includes("error") ||
        text.includes("fail") ||
        text.includes("crash") ||
        text.includes("bug")
      ) {
        category = "INCIDENT";
      }

      // ======================
      // PRIORITY
      // ======================
      let priority = "P3";
      if (data.urgency === "HIGH") priority = "P1";
      else if (data.urgency === "MEDIUM") priority = "P2";

      // ======================
      // OWNER ASSIGNMENT
      // ======================
      const teamMap = {
        IT: "it_queue",
        HR: "hr_queue",
        FINANCE: "finance_queue",
      };

      const owner = teamMap[data.team] || "general_queue";

      const now = new Date().toISOString();

      // ======================
      // 🔥 FIX: DO NOT RESET SLA IF EXISTS
      // ======================
      let sla_due_at = oldItem.sla_due_at;

      if (!sla_due_at) {
        sla_due_at = new Date(
          Date.now() + 8 * 60 * 60 * 1000
        ).toISOString();
      }

      // ======================
      // UPDATE
      // ======================
      await db.send(
        new UpdateItemCommand({
          TableName: process.env.TABLE_NAME,
          Key: marshall(key),
          UpdateExpression:
            "SET category=:c, priority=:p, owner=:o, sla_due_at=:s, #st=:st, updated_at=:u",
          ExpressionAttributeNames: {
            "#st": "status",
          },
          ExpressionAttributeValues: marshall({
            ":c": category,
            ":p": priority,
            ":o": owner,
            ":s": sla_due_at,
            ":st": "TRIAGED",
            ":u": now,
          }),
        })
      );

      // ======================
      // EVENT LOG
      // ======================
      await db.send(
        new PutItemCommand({
          TableName: process.env.TABLE_NAME,
          Item: marshall({
            PK: key.PK,
            SK: `EVENT#${Date.now()}#${crypto
              .randomBytes(3)
              .toString("hex")}`,

            event_id: crypto.randomUUID(),
            ticket_id: data.ticket_id,
            event_type: "TRIAGED",
            event_timestamp: now,
            actor: "system",

            previous_value: {
              status: oldItem.status,
              priority: oldItem.priority,
              owner: oldItem.owner,
            },

            new_value: {
              status: "TRIAGED",
              priority,
              owner,
            },
          }),
        })
      );
    } catch (err) {
      console.error("TRIAGE ERROR:", err);
    }
  }
};