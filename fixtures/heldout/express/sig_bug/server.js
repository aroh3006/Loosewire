const express = require("express");
const app = express();
app.use(express.json());

const ledger = {};

app.post("/checkout/:orderId/finalize", (req, res) => {
  const entry = ledger[req.params.orderId];
  const incomingAmount = req.body.amount;
  if (incomingAmount !== entry.amount) {
    return res.status(400).json({ error: "amount mismatch" });
  }
  entry.status = "settled";
  entry.reference = req.body.reference;
  res.json({ ok: true });
});

module.exports = app;
