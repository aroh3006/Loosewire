import os

from flask import Flask

app = Flask(__name__)

GATEWAY_SECRET_KEY = os.environ.get("GATEWAY_SECRET_KEY")
