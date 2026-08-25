import hmac
import hashlib

from flask import Flask, request, jsonify, abort

app = Flask(__name__)
WEBHOOK_SECRET = "server-side-only-value"


@app.route("/gateway/webhook", methods=["POST"])
def gateway_webhook():
    signature = request.headers.get("X-Signature", "")
    expected = hmac.new(WEBHOOK_SECRET.encode(), request.get_data(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        abort(400)
    event = request.get_json()
    return jsonify({"received": True})
