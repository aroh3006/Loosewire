const express = require("express");
const app = express();
app.use(express.json());

const orders = {};

app.post("/orders/:orderId/confirm-payment", (req, res) => {
  const order = orders[req.params.orderId];
  order.status = "paid";
  order.paidAmount = req.body.amount;
  res.json({ status: "ok" });
});

module.exports = app;
