import os

from fastapi import FastAPI

app = FastAPI()

GATEWAY_PRIVATE_KEY = os.getenv("GATEWAY_PRIVATE_KEY")
