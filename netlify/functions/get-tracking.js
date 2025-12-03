const { neon } = require("@netlify/neon");

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const ensureTable = async (sql) => {
  await sql`
    CREATE TABLE IF NOT EXISTS trackings (
      id SERIAL PRIMARY KEY,
      tracking_token TEXT UNIQUE NOT NULL,
      inventory JSONB,
      sales_orders JSONB,
      assignments JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "method not allowed" }) };
  }

  if (!process.env.NETLIFY_DATABASE_URL) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "database not configured" }) };
  }

  const token = event.queryStringParameters?.token;
  if (!token) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "token is required" }) };
  }

  const sql = neon(process.env.NETLIFY_DATABASE_URL);

  try {
    await ensureTable(sql);
    const rows = await sql`
      SELECT inventory, sales_orders, assignments
      FROM trackings
      WHERE tracking_token = ${token}
      LIMIT 1
    `;
    if (!rows || rows.length === 0) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: "not found" }) };
    }
    const row = rows[0];
    return { statusCode: 200, headers, body: JSON.stringify(row) };
  } catch (err) {
    console.error("get-tracking error", err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "failed to fetch tracking" }) };
  }
};
