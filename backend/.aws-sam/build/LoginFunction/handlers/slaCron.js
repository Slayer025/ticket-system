const {
  DynamoDBClient,
  QueryCommand,
  UpdateItemCommand,
  PutItemCommand,
} = require("@aws-sdk/client-dynamodb");

const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");
const crypto = require("crypto");

const db = new DynamoDBClient({});

// ✅ FIXED: dynamic SLA calculation
const isAtRisk = (createdAt, dueAt) => {
  const now = Date.now();
  const due = new Date(dueAt).getTime();
  const created = new Date(createdAt).getTime();

  if (!due || !created || due <= created) return false;

  const progress = (now - created) / (due - created);
  return progress >= 0.8;
};

exports.handler = async () => {
  const nowIso = new Date().toISOString();
  let lastKey = undefined;

  do {
    const result = await db.send(
      new QueryCommand({
        TableName: process.env.TABLE_NAME,
        IndexName: "GSI_SLA_V2",
        KeyConditionExpression: "sla_state = :s",
        ExpressionAttributeValues: marshall({
          ":s": "ON_TRACK",
        }),
        ExclusiveStartKey: lastKey,
        Limit: 50,
      })
    );

    for (const item of result.Items || []) {
      try {
        const t = unmarshall(item);

        // =========================
        // 🚫 NEVER TOUCH RESOLVED
        // =========================
        if (t.status === "RESOLVED") continue;

        if (!t.sla_due_at || !t.created_at) continue;

        const now = Date.now();
        const due = new Date(t.sla_due_at).getTime();

        let newState = null;
        let eventType = null;

        if (now > due) {
          newState = "BREACHED";
          eventType = "SLA_BREACHED";
        } else if (isAtRisk(t.created_at, t.sla_due_at)) {
          newState = "AT_RISK";
          eventType = "SLA_AT_RISK";
        }

        // =========================
        // 🛑 SKIP IF NO CHANGE
        // =========================
        if (!newState) continue;
        if (t.sla_state === newState) continue;
        if (t.sla_state === "BREACHED") continue; // extra guard

        // =========================
        // UPDATE
        // =========================
        await db.send(
          new UpdateItemCommand({
            TableName: process.env.TABLE_NAME,
            Key: marshall({
              PK: t.PK,
              SK: t.SK,
            }),
            UpdateExpression: "SET sla_state = :s, updated_at = :u",
            ExpressionAttributeValues: marshall({
              ":s": newState,
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
              PK: t.PK,
              SK: `EVENT#${Date.now()}#${crypto
                .randomBytes(3)
                .toString("hex")}`,

              event_id: crypto.randomUUID(),
              ticket_id: t.ticket_id,
              event_type: eventType,
              event_timestamp: nowIso,
              actor: "system",

              previous_value: { sla_state: t.sla_state },
              new_value: { sla_state: newState },
            }),
          })
        );
      } catch (err) {
        console.error("CRON ITEM ERROR:", err);
      }
    }

    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "SLA cron complete" }),
  };
};