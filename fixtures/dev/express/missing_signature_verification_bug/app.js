const express = require("express");
const app = express();
app.use(express.json());

const orders = {};

app.post("/orders/:orderId/complete", (req, res) => {
  const order = orders[req.params.orderId];
  order.status = "paid";
  order.gatewayReference = req.body.reference;
  res.json({ status: "ok" });
});

module.exports = app;
