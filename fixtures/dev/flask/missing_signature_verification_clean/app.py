import hmac
import hashlib

from flask import Flask, request, jsonify

app = Flask(__name__)

orders = {}
SIGNING_SECRET = "server-side-only-value"


def verify_signature(payload, signature):
    expected = hmac.new(SIGNING_SECRET.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


@app.route("/orders/<order_id>/complete", methods=["POST"])
def mark_order_paid(order_id):
    signature = request.headers.get("X-Signature", "")
    if not verify_signature(request.get_data(), signature):
        return jsonify({"error": "invalid signature"}), 400
    order = orders.get(order_id)
    order["status"] = "paid"
    return jsonify({"status": "ok"})
