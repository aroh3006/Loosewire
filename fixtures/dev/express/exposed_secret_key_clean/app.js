const express = require("express");
const app = express();

const gatewaySecretKey = process.env.GATEWAY_SECRET_KEY;

module.exports = app;
