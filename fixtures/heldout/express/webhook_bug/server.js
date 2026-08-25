const express = require("express");
const app = express();
app.use(express.json());

app.post("/integrations/gateway-callback", (req, res) => {
  const payload = req.body;
  if (payload.type === "charge.settled") {
    // handle event
  }
  res.json({ received: true });
});

module.exports = app;
