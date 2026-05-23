# Color Matcher

Pet-проект: сравнение цветов с двух камер (в браузере), ROI, ΔE и подсказка смешивания базовых красок.

## Стек

| Часть | Технологии |
|-------|------------|
| Backend | Python 3.10+, FastAPI, colour-science (без OpenCV / без камер) |
| Frontend | React 19 + TypeScript + Vite, `getUserMedia` |
| ОС | Любая с современным браузером; камеры — у пользователя |

## Структура

```
color-matcher/
  backend/          # Stateless API: analyze-rgb, match, base_colors
    app/
    data/           # base_colors.json — дефолтная палитра
  frontend/         # Камеры, ROI, захват — в браузере
  onlineCam.md      # Плюсы/минусы перехода на браузерные камеры
  scripts/
```

## Быстрый старт (Windows PowerShell)

```powershell
cd d:\projects\cursor\painter\color-matcher
.\scripts\setup.ps1
```

В **двух** терминалах:

```powershell
.\scripts\start-backend.ps1
```

```powershell
.\scripts\start-frontend.ps1
```

Откройте **http://localhost:5173** — разрешите доступ к камере в браузере.

API: http://127.0.0.1:8000/docs

## Камеры

Список устройств — через **MediaDevices API** в браузере. Кнопка «Обновить список камер» запрашивает разрешение и обновляет метки.

Две панели могут использовать **разные** `deviceId`. Если выбрана одна и та же камера — показывается предупреждение.

Выбор камер сохраняется в `localStorage`.

## Захват и ROI

- **Захватить** — кадр с `<video>` в память браузера (`blob:`), цвет из ROI на canvas.
- **Снова live** — возврат к потоку камеры.
- ROI хранится **только на фронте**; на сервер уходят RGB для `match` и `analyze-rgb`.

## Базовые цвета

`backend/data/base_colors.json` — дефолт для подсказки смешивания (`GET /api/base-colors`, используется в `match`).

## Тесты и Quality Gate

```powershell
.\scripts\test.ps1      # только pytest + vitest (QG v1)
.\scripts\qg.ps1        # v1 + v2 (i18n); v3 — после docs/openapi.json
.\scripts\qg.ps1 -Stage v3
```

На Linux/macOS: `./scripts/qg.sh [v1|v2|v3|all]`.

Или отдельно: `cd backend` → `pytest` · `cd frontend` → `npm test` · `python scripts/check_i18n_keys.py`.

## Языки UI

Русский и английский: переключатель в шапке, авто по языку браузера (`localStorage`: `colorMatcher.lang`).

## Камеры в браузере

Бэкенд не открывает USB. Подробности: [onlineCam.md](onlineCam.md).
