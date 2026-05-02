const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "dev_secret";

const getUserFromEvent = (event) => {
  const headers = event.headers || {};

  const authHeader =
    headers.Authorization ||
    headers.authorization ||
    headers.Authorization?.toString() ||
    headers.authorization?.toString();

  if (!authHeader) {
    throw new Error("Unauthorized: Missing Authorization header");
  }

  if (typeof authHeader !== "string") {
    throw new Error("Invalid Authorization header");
  }

  const parts = authHeader.trim().split(" ");

  if (parts.length !== 2) {
    throw new Error("Invalid token format. Expected: Bearer <token>");
  }

  const [scheme, token] = parts;

  if (scheme !== "Bearer" || !token) {
    throw new Error("Invalid token format. Expected: Bearer <token>");
  }

  try {
    const decoded = jwt.verify(token, SECRET);

    if (!decoded?.user_id || !decoded?.role) {
      throw new Error("Invalid token payload");
    }

    return {
      user_id: decoded.user_id,
      email: decoded.email || null,
      role: decoded.role,
    };
  } catch (err) {
    throw new Error("Invalid or expired token");
  }
};

module.exports = { getUserFromEvent };