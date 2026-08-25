const express = require("express");
const app = express();
app.use(express.json());

const products = {};

app.get("/catalog/:productId", (req, res) => {
  res.json(products[req.params.productId]);
});

app.post("/cart/items", (req, res) => {
  res.json({ cartSize: 1 });
});

app.get("/orders/:orderId/tracking", (req, res) => {
  res.json({ status: "processing" });
});

module.exports = app;
