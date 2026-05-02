const { DynamoDBClient, QueryCommand } = require("@aws-sdk/client-dynamodb");
const { unmarshall, marshall } = require("@aws-sdk/util-dynamodb");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const db = new DynamoDBClient({});

// ❗ MUST BE SET (no fallback for security)
const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  throw new Error("JWT_SECRET is not configured");
}

const TABLE_NAME = process.env.TABLE_NAME;
if (!TABLE_NAME) {
  throw new Error("TABLE_NAME is not configured");
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

const generateToken = (user) => {
  return jwt.sign(
    {
      user_id: user.user_id,
      email: user.email,
      role: user.role,
    },
    SECRET,
    { expiresIn: "7d" }
  );
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
    // PARSE BODY
    // ======================
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

    if (!body.email || !body.password) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Missing fields" }),
      };
    }

    // ======================
    // NORMALIZE EMAIL
    // ======================
    const email = body.email.toLowerCase().trim();

    // ======================
    // FIND USER
    // ======================
    const result = await db.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "EmailIndex",
        KeyConditionExpression: "email = :e",
        ExpressionAttributeValues: marshall({
          ":e": email,
        }),
      })
    );

    if (!result.Items || result.Items.length === 0) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: "User not found" }),
      };
    }

    const user = unmarshall(result.Items[0]);

    // ======================
    // PASSWORD CHECK
    // ======================
    const isValid = await bcrypt.compare(body.password, user.password_hash);

    if (!isValid) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Invalid password" }),
      };
    }

    // ======================
    // SUCCESS RESPONSE
    // ======================
    const token = generateToken(user);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        token,
        user: {
          user_id: user.user_id,
          email: user.email,
          role: user.role,
        },
      }),
    };
  } catch (err) {
    console.error("LOGIN ERROR:", err);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: err.message,
      }),
    };
  }
};