const express = require("express");
const app = express();
app.use(express.json());

const orders = {};

app.post("/orders/:orderId/confirm-payment", (req, res) => {
  const order = orders[req.params.orderId];
  const confirmedAmount = req.body.amount;
  if (confirmedAmount !== order.amount) {
    return res.status(400).json({ error: "amount mismatch" });
  }
  order.status = "paid";
  res.json({ status: "ok" });
});

module.exports = app;
