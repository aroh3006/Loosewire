const apiSecretKey = "gwk_live_7Rk2QpZ9mXvB4LnT6HcW8YdF";

async function subscribe(plan) {
  const res = await fetch("/subscriptions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + apiSecretKey,
    },
    body: JSON.stringify({ plan }),
  });
  return res.json();
}

document.querySelectorAll("[data-plan]").forEach((button) => {
  button.addEventListener("click", async () => {
    const record = await subscribe(button.dataset.plan);
    document.getElementById("plan-status").textContent = record.status;
  });
});
