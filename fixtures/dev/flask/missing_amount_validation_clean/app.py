from flask import Flask, request, jsonify

app = Flask(__name__)

orders = {}


@app.route("/orders/<order_id>/confirm_payment", methods=["POST"])
def confirm_payment(order_id):
    data = request.get_json()
    order = orders.get(order_id)
    confirmed_amount = data.get("amount")
    if confirmed_amount != order["amount"]:
        return jsonify({"error": "amount mismatch"}), 400
    order["status"] = "paid"
    return jsonify({"status": "ok"})
