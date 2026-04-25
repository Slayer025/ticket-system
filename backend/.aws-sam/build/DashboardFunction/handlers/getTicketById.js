const {
  DynamoDBClient,
  QueryCommand,
} = require("@aws-sdk/client-dynamodb");

const { unmarshall, marshall } = require("@aws-sdk/util-dynamodb");

const db = new DynamoDBClient({});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: corsHeaders };
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

    let items = [];
    let ExclusiveStartKey;

    do {
      const result = await db.send(
        new QueryCommand({
          TableName: process.env.TABLE_NAME,
          KeyConditionExpression: "PK = :pk",
          ExpressionAttributeValues: marshall({
            ":pk": pk,
          }),
          ExclusiveStartKey,
        })
      );

      if (result.Items) items.push(...result.Items);
      ExclusiveStartKey = result.LastEvaluatedKey;
    } while (ExclusiveStartKey);

    const parsed = items.map(unmarshall);

    const metadata = parsed.find((i) => i.SK === "METADATA");

    const events = parsed
      .filter((i) => i.SK.startsWith("EVENT#"))
      .sort((a, b) => b.SK.localeCompare(a.SK));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        ticket: metadata || null,
        events,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message }),
    };
  }
};