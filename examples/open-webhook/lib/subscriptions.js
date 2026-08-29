const crypto = require("crypto");

const PLANS = {
  basic: 900,
  pro: 2900,
  team: 9900,
};

const records = new Map();

function create(plan) {
  const price = PLANS[plan];
  if (price === undefined) {
    throw new Error("unknown plan: " + plan);
  }

  const record = {
    id: crypto.randomUUID(),
    plan,
    price,
    status: "incomplete",
    periodEnd: null,
  };
  records.set(record.id, record);
  return record;
}

function markActive(id, periodEnd) {
  const record = records.get(id);
  if (!record) {
    return;
  }
  record.status = "active";
  record.periodEnd = periodEnd;
}

function markPastDue(id) {
  const record = records.get(id);
  if (record) {
    record.status = "past_due";
  }
}

module.exports = { create, markActive, markPastDue };
