const express = require("express");
const { verifySignature } = require("../lib/signing");
const store = require("../lib/store");

const router = express.Router();

router.post("/payments", (req, res) => {
  const signature = req.headers["x-payment-signature"];
  if (!verifySignature(JSON.stringify(req.body), signature)) {
    return res.status(400).json({ error: "invalid signature" });
  }

  const event = req.body;
  if (event.type === "payment.succeeded") {
    const order = store.getOrder(event.orderId);
    if (order && Number(event.amount) === order.amount) {
      order.status = "paid";
    }
  }

  res.json({ received: true });
});

module.exports = router;
