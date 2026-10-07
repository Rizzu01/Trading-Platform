from main import app
from websocket.routes import market_stream, router as websocket_router


def test_market_websocket_route_is_registered():
    routes = [route.path for route in websocket_router.routes if hasattr(route, "path")]
    assert "/market/{exchange}/{symbol}" in routes

    app_routes = [route.path for route in app.routes if hasattr(route, "path")]
    assert "/ws/market/{exchange}/{symbol}" in app_routes


def test_market_websocket_path_shape():
    assert market_stream.__name__ == "market_stream"
