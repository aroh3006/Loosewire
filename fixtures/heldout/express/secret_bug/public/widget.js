const clientSecretKey = "pk7Qm2XvLsN9tRbWyJ4hZcE0aFgD3Uk8";

function renderCheckoutWidget(total) {
  return fetch("/checkout/start", {
    method: "POST",
    body: JSON.stringify({ total, key: clientSecretKey }),
  });
}
