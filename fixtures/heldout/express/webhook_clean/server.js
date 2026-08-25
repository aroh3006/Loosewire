const express = require("express");
const crypto = require("crypto");
const app = express();
app.use(express.json());

const EVENTS_SECRET = "server-side-only-value";

app.post("/integrations/gateway-callback", (req, res) => {
  const signature = req.headers["x-gateway-signature"] || "";
  const expected = crypto.createHmac("sha256", EVENTS_SECRET).update(JSON.stringify(req.body)).digest("hex");
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
    return res.status(400).json({ error: "bad signature" });
  }
  res.json({ received: true });
});

module.exports = app;
