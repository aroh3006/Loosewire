from flask import Flask, request, jsonify

app = Flask(__name__)

orders = {}


@app.route("/orders/<order_id>/complete", methods=["POST"])
def mark_order_paid(order_id):
    data = request.get_json()
    order = orders.get(order_id)
    order["status"] = "paid"
    order["gateway_reference"] = data.get("reference")
    return jsonify({"status": "ok"})
