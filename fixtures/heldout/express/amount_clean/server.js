const express = require("express");
const crypto = require("crypto");
const app = express();
app.use(express.json());

const ledger = {};
const SETTLEMENT_KEY = "server-side-only-value";

app.post("/checkout/:orderId/settle", (req, res) => {
  const signature = req.headers["x-gateway-signature"] || "";
  const expected = crypto.createHmac("sha256", SETTLEMENT_KEY).update(JSON.stringify(req.body)).digest("hex");
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
    return res.status(400).json({ error: "bad signature" });
  }
  const entry = ledger[req.params.orderId];
  const incomingAmount = req.body.total;
  if (incomingAmount !== entry.amount) {
    return res.status(400).json({ error: "amount mismatch" });
  }
  entry.status = "settled";
  res.json({ ok: true });
});

module.exports = app;
