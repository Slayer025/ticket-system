const {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
} = require("@aws-sdk/client-dynamodb");

const { marshall } = require("@aws-sdk/util-dynamodb");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const db = new DynamoDBClient({});

// MUST BE SET IN ENV
const SECRET = process.env.JWT_SECRET;
if (!SECRET) throw new Error("JWT_SECRET is not configured");

// Optional secret to allow admin creation
const ADMIN_SECRET = process.env.ADMIN_SECRET || "dev_admin_secret";

const TABLE_NAME = process.env.TABLE_NAME;
if (!TABLE_NAME) throw new Error("TABLE_NAME is not configured");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

const generateToken = (user) =>
  jwt.sign(
    {
      user_id: user.user_id,
      email: user.email,
      role: user.role,
    },
    SECRET,
    { expiresIn: "7d" }
  );

exports.handler = async (event) => {
  try {
    // CORS preflight
    if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders };

    // Parse request body
    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Invalid JSON" }) };
    }

    const { email: rawEmail, password, name, role: requestedRole, admin_secret } = body;

    if (!rawEmail || !password || !name) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Missing fields" }) };
    }

    const email = rawEmail.toLowerCase().trim();

    // Check if user already exists
    const existing = await db.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "EmailIndex",
        KeyConditionExpression: "email = :e",
        ExpressionAttributeValues: marshall({ ":e": email }),
      })
    );

    if (existing.Items && existing.Items.length > 0) {
      return { statusCode: 409, headers: corsHeaders, body: JSON.stringify({ error: "User already exists" }) };
    }

    // Determine role
    let role = "USER"; // default
    if (requestedRole === "ADMIN") {
      if (admin_secret === ADMIN_SECRET) {
        role = "ADMIN";
      } else {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Invalid admin secret" }),
        };
      }
    } else if (requestedRole === "AGENT") {
      role = "AGENT";
    }

    // Create user
    const user_id = crypto.randomUUID();
    const password_hash = await bcrypt.hash(password, 10);

    const user = {
      PK: `USER#${user_id}`,
      SK: "PROFILE",
      user_id,
      email,
      name,
      role,
      password_hash,
      created_at: new Date().toISOString(),
    };

    await db.send(new PutItemCommand({ TableName: TABLE_NAME, Item: marshall(user) }));

    // Return token
    const token = generateToken(user);

    return {
      statusCode: 201,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        token,
        user: { user_id, email, role },
      }),
    };
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
  }
};