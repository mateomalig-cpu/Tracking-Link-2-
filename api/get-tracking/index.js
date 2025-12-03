const { Client } = require("pg");

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

async function getClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const client = new Client({ connectionString });
  await client.connect();
  return client;
}

async function ensureTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS trackings (
      id SERIAL PRIMARY KEY,
      tracking_token TEXT UNIQUE NOT NULL,
      inventory JSONB,
      sales_orders JSONB,
      assignments JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

module.exports = async function (context, req) {
  if (req.method === "OPTIONS") {
    context.res = { status: 200, headers, body: "" };
    return;
  }

  if (req.method !== "GET") {
    context.res = { status: 405, headers, body: JSON.stringify({ error: "method not allowed" }) };
    return;
  }

  const token = req.query.token || (req.params && req.params.token);
  if (!token) {
    context.res = { status: 400, headers, body: JSON.stringify({ error: "token is required" }) };
    return;
  }

  let client;
  try {
    client = await getClient();
    await ensureTable(client);
    const result = await client.query(
      `SELECT inventory, sales_orders, assignments FROM trackings WHERE tracking_token = $1 LIMIT 1`,
      [token]
    );
    if (!result.rows || result.rows.length === 0) {
      context.res = { status: 404, headers, body: JSON.stringify({ error: "not found" }) };
      return;
    }
    const row = result.rows[0];
    context.res = { status: 200, headers, body: JSON.stringify(row) };
  } catch (err) {
    context.log.error("get-tracking error", err);
    context.res = { status: 500, headers, body: JSON.stringify({ error: "failed to fetch tracking" }) };
  } finally {
    if (client) {
      try {
        await client.end();
      } catch (_) {}
    }
  }
};
