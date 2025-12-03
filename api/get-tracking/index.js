module.exports = async function (context, req) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  // CORS preflight
  if (req.method === "OPTIONS") {
    context.res = { status: 200, headers, body: "" };
    return;
  }

  if (req.method !== "GET") {
    context.res = { status: 405, headers, body: JSON.stringify({ error: "method not allowed" }) };
    return;
  }

  const token = (req.query && req.query.token) || (req.params && req.params.token);
  if (!token) {
    context.res = { status: 400, headers, body: JSON.stringify({ error: "token is required" }) };
    return;
  }

  context.res = {
    status: 200,
    headers,
    body: JSON.stringify({
      inventory: [
        { id: 1, product: "TEST PRODUCT", status: "En camino", token },
      ],
      sales_orders: [],
      assignments: [],
    }),
  };
};
