const express = require("express");
const orderRoutes = require("./routes/orders");
const webhookRoutes = require("./routes/webhook");

const app = express();
app.use(express.json());
app.use(express.static("public"));

app.use("/orders", orderRoutes);
app.use("/webhook", webhookRoutes);

const port = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(port, () => {
    console.log("store listening on " + port);
  });
}

module.exports = app;
