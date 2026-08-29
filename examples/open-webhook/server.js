const express = require("express");
const subscriptions = require("./lib/subscriptions");

const app = express();
app.use(express.json());
app.use(express.static("public"));

app.post("/subscriptions", (req, res) => {
  const plan = req.body.plan;
  const record = subscriptions.create(plan);
  res.status(201).json(record);
});

app.post("/gateway/webhook", (req, res) => {
  const event = req.body;

  if (event.type === "invoice.paid") {
    subscriptions.markActive(event.subscriptionId, event.periodEnd);
  }

  if (event.type === "invoice.failed") {
    subscriptions.markPastDue(event.subscriptionId);
  }

  res.json({ received: true });
});

const port = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(port, () => {
    console.log("billing service listening on " + port);
  });
}

module.exports = app;
