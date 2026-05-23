from app.color import analyze_rgb, delta_e_2000, rgb_to_hex, rgb_to_lab


def test_rgb_to_hex():
    assert rgb_to_hex((255, 0, 0)) == "#FF0000"


def test_analyze_rgb_hex():
    reading = analyze_rgb((0, 128, 255))
    assert reading.hex == "#0080FF"
    assert reading.rgb == (0, 128, 255)


def test_delta_e_identical_is_zero():
    rgb = (100, 120, 140)
    assert delta_e_2000(rgb, rgb) == 0.0


def test_delta_e_different_colors_positive():
    d = delta_e_2000((255, 0, 0), (0, 0, 255))
    assert d > 0


def test_rgb_to_lab_reasonable_range():
    l, a, b = rgb_to_lab((128, 128, 128))
    assert 0 <= l <= 100
