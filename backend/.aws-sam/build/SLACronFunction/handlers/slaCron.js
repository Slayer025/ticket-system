const {
  DynamoDBClient,
  QueryCommand,
  UpdateItemCommand,
  PutItemCommand,
} = require("@aws-sdk/client-dynamodb");

const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");
const crypto = require("crypto");

const db = new DynamoDBClient({});

const isAtRisk = (dueAt) => {
  const now = Date.now();
  const due = new Date(dueAt).getTime();

  const total = 8 * 60 * 60 * 1000;
  const elapsed = now - (due - total);

  return elapsed / total >= 0.8;
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
      const t = unmarshall(item);

      const now = Date.now();
      const due = new Date(t.sla_due_at).getTime();

      let newState = null;

      if (now > due) {
        newState = "BREACHED";
      } else if (isAtRisk(t.sla_due_at)) {
        newState = "AT_RISK";
      }

      if (!newState) continue;

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

      await db.send(
        new PutItemCommand({
          TableName: process.env.TABLE_NAME,
          Item: marshall({
            PK: t.PK,
            SK: `EVENT#${Date.now()}#${crypto.randomBytes(3).toString("hex")}`,
            event_id: crypto.randomUUID(),
            ticket_id: t.ticket_id,
            event_type:
              newState === "AT_RISK" ? "SLA_AT_RISK" : "SLA_BREACHED",
            event_timestamp: nowIso,
            actor: "system",
            previous_value: { sla_state: t.sla_state },
            new_value: { sla_state: newState },
          }),
        })
      );
    }

    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "SLA cron complete" }),
  };
};