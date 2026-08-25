from flask import Flask, request, jsonify

app = Flask(__name__)


@app.route("/gateway/webhook", methods=["POST"])
def gateway_webhook():
    event = request.get_json()
    if event.get("type") == "payment.succeeded":
        pass
    return jsonify({"received": True})
