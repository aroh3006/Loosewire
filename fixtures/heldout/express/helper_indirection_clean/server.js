const express = require("express");
const crypto = require("crypto");
const app = express();
app.use(express.json());

const ledger = {};
const SETTLEMENT_KEY = "server-side-only-value";

function isRequestAuthentic(rawBody, signature) {
  const expected = crypto.createHmac("sha256", SETTLEMENT_KEY).update(rawBody).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

app.post("/checkout/:orderId/finalize", (req, res) => {
  const signature = req.headers["x-gateway-signature"] || "";
  if (!isRequestAuthentic(JSON.stringify(req.body), signature)) {
    return res.status(400).json({ error: "bad signature" });
  }
  const entry = ledger[req.params.orderId];
  const incomingAmount = req.body.amount;
  if (incomingAmount !== entry.amount) {
    return res.status(400).json({ error: "amount mismatch" });
  }
  entry.status = "settled";
  res.json({ ok: true });
});

module.exports = app;
