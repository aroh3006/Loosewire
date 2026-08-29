const crypto = require("crypto");

const PRICES = {
  "desk-lamp": 2400,
  "notebook": 650,
  "pen-set": 1200,
};

const orders = new Map();

function createOrder(items) {
  let amount = 0;
  for (const item of items) {
    const unit = PRICES[item.sku];
    if (unit === undefined) {
      throw new Error("unknown sku: " + item.sku);
    }
    amount += unit * item.quantity;
  }

  const order = {
    id: crypto.randomUUID(),
    items,
    amount,
    status: "pending",
  };
  orders.set(order.id, order);
  return order;
}

function getOrder(id) {
  return orders.get(id);
}

module.exports = { createOrder, getOrder };
