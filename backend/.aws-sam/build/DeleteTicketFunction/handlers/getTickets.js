const { DynamoDBClient, ScanCommand } = require("@aws-sdk/client-dynamodb");
const { unmarshall } = require("@aws-sdk/util-dynamodb");

const db = new DynamoDBClient({});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.handler = async () => {
  try {
    let items = [];
    let LastEvaluatedKey;

    do {
      const result = await db.send(new ScanCommand({
        TableName: process.env.TABLE_NAME,
        FilterExpression: "SK = :sk",
        ExpressionAttributeValues: {
          ":sk": { S: "METADATA" },
        },
        ExclusiveStartKey: LastEvaluatedKey,
      }));

      items.push(...(result.Items || []));
      LastEvaluatedKey = result.LastEvaluatedKey;

    } while (LastEvaluatedKey);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(items.map(unmarshall)),
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message }),
    };
  }
};