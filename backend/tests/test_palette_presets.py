from fastapi.testclient import TestClient

from app.main import app
from app.palette_presets import DEFAULT_PRESET_ID, get_preset_colors

client = TestClient(app)


def test_list_palette_presets():
    res = client.get("/api/palette-presets")
    assert res.status_code == 200
    body = res.json()
    assert body["defaultPresetId"] == DEFAULT_PRESET_ID
    assert len(body["presets"]) >= 3
    ids = {p["id"] for p in body["presets"]}
    assert "classic-10" in ids
    assert "minimal-5" in ids


def test_get_palette_preset():
    res = client.get("/api/palette-presets/classic-10")
    assert res.status_code == 200
    colors = res.json()["colors"]
    assert len(colors) == 10
    assert colors[0]["name"]


def test_unknown_preset_404():
    assert client.get("/api/palette-presets/nope").status_code == 404


def test_post_match_with_custom_bases():
    bases = get_preset_colors("minimal-5")
    res = client.post(
        "/api/match",
        json={
            "target": {"r": 255, "g": 0, "b": 0},
            "palette": {"r": 0, "g": 255, "b": 0},
            "baseColors": bases,
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["mix"]["available"] is True
    assert len(body["mix"]["components"]) > 0
