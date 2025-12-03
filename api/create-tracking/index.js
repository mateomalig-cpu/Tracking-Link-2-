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

  if (req.method !== "POST") {
    context.res = { status: 405, headers, body: JSON.stringify({ error: "method not allowed" }) };
    return;
  }

  let payload = {};
  try {
    payload = req.body || JSON.parse(req.rawBody || "{}");
  } catch {
    context.res = { status: 400, headers, body: JSON.stringify({ error: "invalid JSON body" }) };
    return;
  }

  const { token, inventory = [], salesOrders = [], assignments = [] } = payload;
  if (!token) {
    context.res = { status: 400, headers, body: JSON.stringify({ error: "token is required" }) };
    return;
  }

  let client;
  try {
    client = await getClient();
    await ensureTable(client);
    await client.query(
      `
        INSERT INTO trackings (tracking_token, inventory, sales_orders, assignments)
        VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb)
        ON CONFLICT (tracking_token)
        DO UPDATE SET inventory = EXCLUDED.inventory, sales_orders = EXCLUDED.sales_orders, assignments = EXCLUDED.assignments
      `,
      [token, JSON.stringify(inventory), JSON.stringify(salesOrders), JSON.stringify(assignments)]
    );
    context.res = { status: 200, headers, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    context.log.error("create-tracking error", err);
    context.res = { status: 500, headers, body: JSON.stringify({ error: "failed to save tracking" }) };
  } finally {
    if (client) {
      try {
        await client.end();
      } catch (_) {}
    }
  }
};
