const crypto = require("crypto");

const SIGNING_SECRET = process.env.PAYMENT_SIGNING_SECRET;

function expectedSignature(payload) {
  return crypto
    .createHmac("sha256", SIGNING_SECRET)
    .update(payload)
    .digest("hex");
}

function verifySignature(payload, signature) {
  if (!signature) {
    return false;
  }
  const expected = expectedSignature(payload);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

module.exports = { verifySignature };
