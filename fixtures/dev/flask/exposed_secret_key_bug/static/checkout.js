// client side checkout widget
const gatewaySecretKey = "gwk_9fQ2mLp7XsRt4NbYkWc8VaJhZeQ3T";

function startCheckout(amount) {
  return fetch("/orders", {
    method: "POST",
    body: JSON.stringify({ amount, key: gatewaySecretKey }),
  });
}
