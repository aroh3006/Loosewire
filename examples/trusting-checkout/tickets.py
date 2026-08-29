import uuid

EVENTS = {
    "harbour-jazz": {"name": "Harbour Jazz Night", "price": 1800},
    "clay-workshop": {"name": "Beginner Clay Workshop", "price": 3500},
    "river-run": {"name": "River Run 10K", "price": 1200},
}

_orders = {}


def create_order(event_id, quantity):
    event = EVENTS[event_id]
    order = {
        "id": str(uuid.uuid4()),
        "event_id": event_id,
        "quantity": quantity,
        "amount": event["price"] * quantity,
        "status": "pending",
    }
    _orders[order["id"]] = order
    return order


def get_order(order_id):
    return _orders.get(order_id)
