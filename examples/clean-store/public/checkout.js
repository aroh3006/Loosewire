async function createOrder(items) {
  const res = await fetch("/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  return res.json();
}

async function refreshOrder(orderId) {
  const res = await fetch("/orders/" + orderId);
  const order = await res.json();
  document.getElementById("status").textContent = order.status;
  return order;
}

document.getElementById("buy").addEventListener("click", async () => {
  const items = [{ sku: "desk-lamp", quantity: 1 }];
  const order = await createOrder(items);
  window.location.href = "/pay.html?order=" + order.id;
});
