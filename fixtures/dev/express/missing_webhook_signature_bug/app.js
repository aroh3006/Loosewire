const express = require("express");
const app = express();
app.use(express.json());

app.post("/gateway/webhook", (req, res) => {
  const event = req.body;
  if (event.type === "payment.succeeded") {
    // handle event
  }
  res.json({ received: true });
});

module.exports = app;
