const express = require("express");
const crypto = require("crypto");
const app = express();
app.use(express.json());

const WEBHOOK_SECRET = "server-side-only-value";

app.post("/gateway/webhook", (req, res) => {
  const signature = req.headers["x-signature"] || "";
  const expected = crypto.createHmac("sha256", WEBHOOK_SECRET).update(JSON.stringify(req.body)).digest("hex");
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
    return res.status(400).json({ error: "invalid signature" });
  }
  res.json({ received: true });
});

module.exports = app;
