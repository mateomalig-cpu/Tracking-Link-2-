const { neon } = require("@netlify/neon");

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
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "method not allowed" }) };
  }

  if (!process.env.NETLIFY_DATABASE_URL) {
    return { statusCode: 500, body: JSON.stringify({ error: "database not configured" }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (err) {
    return { statusCode: 400, body: JSON.stringify({ error: "invalid JSON body" }) };
  }

  const { token, inventory = [], salesOrders = [], assignments = [] } = payload;
  if (!token) {
    return { statusCode: 400, body: JSON.stringify({ error: "token is required" }) };
  }

  const sql = neon(process.env.NETLIFY_DATABASE_URL);

  try {
    await ensureTable(sql);
    await sql`
      INSERT INTO trackings (tracking_token, inventory, sales_orders, assignments)
      VALUES (${token}, ${JSON.stringify(inventory)}::jsonb, ${JSON.stringify(salesOrders)}::jsonb, ${JSON.stringify(assignments)}::jsonb)
      ON CONFLICT (tracking_token)
      DO UPDATE SET inventory = EXCLUDED.inventory, sales_orders = EXCLUDED.sales_orders, assignments = EXCLUDED.assignments
    `;
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true }),
    };
  } catch (err) {
    console.error("create-tracking error", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "failed to save tracking" }),
    };
  }
};
