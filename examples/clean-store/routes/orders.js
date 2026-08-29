const express = require("express");
const { verifySignature } = require("../lib/signing");
const store = require("../lib/store");

const router = express.Router();

router.post("/", (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "cart is empty" });
  }
  const order = store.createOrder(items);
  res.status(201).json({ id: order.id, amount: order.amount });
});

router.get("/:orderId", (req, res) => {
  const order = store.getOrder(req.params.orderId);
  if (!order) {
    return res.status(404).json({ error: "not found" });
  }
  res.json(order);
});

router.post("/:orderId/confirm-payment", (req, res) => {
  const order = store.getOrder(req.params.orderId);
  if (!order) {
    return res.status(404).json({ error: "not found" });
  }

  const signature = req.headers["x-payment-signature"];
  if (!verifySignature(JSON.stringify(req.body), signature)) {
    return res.status(400).json({ error: "invalid signature" });
  }

  const confirmedAmount = Number(req.body.amount);
  if (confirmedAmount !== order.amount) {
    return res.status(400).json({ error: "amount mismatch" });
  }

  order.status = "paid";
  order.reference = req.body.reference;
  res.json({ status: "ok", id: order.id });
});

module.exports = router;
