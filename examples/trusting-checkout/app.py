import os

from flask import Flask, jsonify, request

from tickets import EVENTS, create_order, get_order

app = Flask(__name__)
app.config["GATEWAY_KEY"] = os.environ.get("GATEWAY_KEY")


@app.route("/events", methods=["GET"])
def list_events():
    return jsonify(EVENTS)


@app.route("/orders", methods=["POST"])
def start_order():
    data = request.get_json()
    event_id = data.get("event_id")
    quantity = int(data.get("quantity", 1))

    if event_id not in EVENTS:
        return jsonify({"error": "unknown event"}), 404
    if quantity < 1 or quantity > 6:
        return jsonify({"error": "quantity out of range"}), 400

    order = create_order(event_id, quantity)
    return jsonify({"id": order["id"], "amount": order["amount"]}), 201


@app.route("/orders/<order_id>/complete", methods=["POST"])
def complete_order(order_id):
    data = request.get_json()
    order = get_order(order_id)

    if order is None:
        return jsonify({"error": "not found"}), 404

    order["status"] = "paid"
    order["paid_amount"] = data.get("amount")
    order["gateway_reference"] = data.get("reference")

    return jsonify({"status": "ok", "id": order["id"]})


if __name__ == "__main__":
    app.run(port=5000)
