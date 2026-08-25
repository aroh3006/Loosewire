from fastapi import FastAPI

app = FastAPI()

products = {}


@app.get("/catalog/{product_id}")
async def get_product(product_id: str):
    return products.get(product_id)


@app.post("/cart/items")
async def add_to_cart(item: dict):
    return {"cart_size": 1}


@app.get("/orders/{order_id}/tracking")
async def get_order_tracking(order_id: str):
    return {"status": "processing"}
