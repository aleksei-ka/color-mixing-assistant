#!/usr/bin/env python3
"""Fail if docs/openapi.json does not match the live FastAPI schema."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
OPENAPI = ROOT / "docs" / "openapi.json"

sys.path.insert(0, str(BACKEND))

from app.main import app  # noqa: E402


def main() -> int:
    if not OPENAPI.is_file():
        print(f"Missing {OPENAPI}", file=sys.stderr)
        return 1
    committed = json.loads(OPENAPI.read_text(encoding="utf-8"))
    current = app.openapi()
    if committed == current:
        print("OpenAPI spec OK")
        return 0
    print(
        "docs/openapi.json is out of date. Run: python scripts/export_openapi.py",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
