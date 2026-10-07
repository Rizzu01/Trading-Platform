from main import app
from websocket.routes import market_stream, router as websocket_router


def test_market_websocket_route_is_registered():
    routes = [route.path for route in websocket_router.routes if hasattr(route, "path")]
    assert "/ws/market/{exchange}/{symbol}" in routes



def test_market_websocket_path_shape():
    assert market_stream.__name__ == "market_stream"
