from flask import Flask, request, jsonify

app = Flask(__name__)

orders = {}


@app.route("/orders/<order_id>/confirm_payment", methods=["POST"])
def confirm_payment(order_id):
    data = request.get_json()
    order = orders.get(order_id)
    order["status"] = "paid"
    order["paid_amount"] = data.get("amount")
    return jsonify({"status": "ok"})
