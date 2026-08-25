const express = require("express");
const crypto = require("crypto");
const app = express();
app.use(express.json());

const orders = {};
const SIGNING_SECRET = "server-side-only-value";

function verifySignature(payload, signature) {
  const expected = crypto.createHmac("sha256", SIGNING_SECRET).update(payload).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

app.post("/orders/:orderId/complete", (req, res) => {
  const signature = req.headers["x-signature"] || "";
  if (!verifySignature(JSON.stringify(req.body), signature)) {
    return res.status(400).json({ error: "invalid signature" });
  }
  const order = orders[req.params.orderId];
  order.status = "paid";
  res.json({ status: "ok" });
});

module.exports = app;
