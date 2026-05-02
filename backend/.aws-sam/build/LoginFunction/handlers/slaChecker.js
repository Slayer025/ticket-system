const {
  DynamoDBClient,
  UpdateItemCommand,
  PutItemCommand,
} = require("@aws-sdk/client-dynamodb");

const { unmarshall, marshall } = require("@aws-sdk/util-dynamodb");
const crypto = require("crypto");

const db = new DynamoDBClient({});

exports.handler = async (event) => {
  for (const record of event.Records || []) {
    try {
      // =========================
      // ONLY INSERT / MODIFY
      // =========================
      if (!["INSERT", "MODIFY"].includes(record.eventName)) continue;

      const item = unmarshall(record.dynamodb.NewImage || {});

      if (!item || item.SK !== "METADATA") continue;

      // =========================
      // 🚫 STOP IF RESOLVED
      // =========================
      if (item.status === "RESOLVED") continue;

      if (!item.sla_due_at || !item.created_at) continue;

      const now = Date.now();
      const due = new Date(item.sla_due_at).getTime();
      const created = new Date(item.created_at).getTime();

      if (!due || !created || due <= created) continue;

      const progress = (now - created) / (due - created);

      let state = "ON_TRACK";
      let statusUpdate = null;

      if (progress >= 1) {
        state = "BREACHED";
        statusUpdate = "BREACHED"; // optional auto-status
      } else if (progress >= 0.8) {
        state = "AT_RISK";
      }

      // =========================
      // 🛑 FIXED: DO NOT RETURN
      // =========================
      if (item.sla_state === "BREACHED") continue;
      if (item.sla_state === state) continue;

      const nowIso = new Date().toISOString();

      // =========================
      // UPDATE ITEM
      // =========================
      await db.send(
        new UpdateItemCommand({
          TableName: process.env.TABLE_NAME,
          Key: marshall({
            PK: item.PK,
            SK: item.SK,
          }),
          UpdateExpression:
            "SET sla_state = :s" +
            (statusUpdate ? ", #st = :st" : "") +
            ", updated_at = :u",
          ExpressionAttributeNames: statusUpdate
            ? { "#st": "status" }
            : {},
          ExpressionAttributeValues: marshall({
            ":s": state,
            ...(statusUpdate && { ":st": statusUpdate }),
            ":u": nowIso,
          }),
        })
      );

      // =========================
      // EVENT LOG
      // =========================
      await db.send(
        new PutItemCommand({
          TableName: process.env.TABLE_NAME,
          Item: marshall({
            PK: item.PK,
            SK: `EVENT#${Date.now()}#${crypto
              .randomBytes(3)
              .toString("hex")}`,

            event_id: crypto.randomUUID(),
            ticket_id: item.ticket_id,
            event_type: "SLA_UPDATED",
            event_timestamp: nowIso,
            actor: "system",

            previous_value: { sla_state: item.sla_state },
            new_value: { sla_state: state },
          }),
        })
      );
    } catch (err) {
      console.error("Stream error:", err);
    }
  }
};