#!/usr/bin/env python3
"""Fail if en.json and ru.json locale keys differ."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOCALES = ROOT / "frontend" / "src" / "i18n" / "locales"


def flatten_keys(obj: dict, prefix: str = "") -> set[str]:
    keys: set[str] = set()
    for key, value in obj.items():
        path = f"{prefix}.{key}" if prefix else key
        if isinstance(value, dict):
            keys |= flatten_keys(value, path)
        else:
            keys.add(path)
    return keys


def main() -> int:
    en_path = LOCALES / "en.json"
    ru_path = LOCALES / "ru.json"
    if not en_path.is_file() or not ru_path.is_file():
        print("Locale files not found:", LOCALES, file=sys.stderr)
        return 1

    en = json.loads(en_path.read_text(encoding="utf-8"))
    ru = json.loads(ru_path.read_text(encoding="utf-8"))
    en_keys = flatten_keys(en)
    ru_keys = flatten_keys(ru)

    missing_ru = sorted(en_keys - ru_keys)
    missing_en = sorted(ru_keys - en_keys)
    if missing_ru or missing_en:
        if missing_ru:
            print("Missing in ru.json:", *missing_ru, sep="\n  ")
        if missing_en:
            print("Missing in en.json:", *missing_en, sep="\n  ")
        return 1

    print(f"i18n OK: {len(en_keys)} keys in en/ru")
    return 0


if __name__ == "__main__":
    sys.exit(main())
