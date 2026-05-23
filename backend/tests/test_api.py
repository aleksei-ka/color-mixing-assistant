from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    assert client.get("/api/health").json() == {"status": "ok"}


def test_config():
    data = client.get("/api/config").json()
    assert "roiSize" in data
    assert "frameWidth" in data


def test_analyze_rgb():
    res = client.post("/api/analyze-rgb", json={"r": 255, "g": 0, "b": 0})
    assert res.status_code == 200
    body = res.json()
    assert body["hex"] == "#FF0000"
    assert body["rgb"]["r"] == 255


def test_match_requires_both_colors():
    assert client.get("/api/match").status_code == 400


def test_match_with_query_colors():
    res = client.get(
        "/api/match",
        params={
            "targetR": 255,
            "targetG": 0,
            "targetB": 0,
            "paletteR": 0,
            "paletteG": 255,
            "paletteB": 0,
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert "deltaE" in body
    assert body["deltaE"] > 0
    assert "mix" in body
