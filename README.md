# Color Matcher

Pet-проект: две USB-камеры, центральный квадрат ROI, определение цвета и подсказка смешивания базовых красок.

## Стек

| Часть | Технологии |
|-------|------------|
| Backend | Python 3.10+, FastAPI, OpenCV, colour-science |
| Frontend | **React 19** + **TypeScript** + **Vite** (популярный стек для изучения) |
| ОС | Windows (DirectShow для веб-камер) |

## Структура

```
color-matcher/
  backend/          # API и захват камер
    app/
    data/           # base_colors.json — ваши базовые цвета
  frontend/         # React UI в браузере
  scripts/          # setup и запуск на Windows
```

## Требования

На вашей машине уже есть (проверено при создании каркаса):

- **Python 3.13**
- **Node.js 22** + npm

Если чего-то нет — установите с [python.org](https://www.python.org/downloads/) и [nodejs.org](https://nodejs.org/).

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

Откройте в браузере: **http://localhost:5173**

Документация API: http://127.0.0.1:8000/docs

## Камеры

В интерфейсе у каждой панели есть выпадающий список устройств и кнопка **«Обновить список камер»** (сканируются индексы 0–9).

Стартовые индексы можно задать перед запуском бэкенда:

```powershell
$env:COLOR_MATCHER_CAMERA_TARGET_INDEX = "0"
$env:COLOR_MATCHER_CAMERA_PALETTE_INDEX = "1"
.\scripts\start-backend.ps1
```

## Захват цвета для сравнения

У **каждой камеры** своя кнопка **«Захватить цвет»** — фиксируется снимок и цвет только этой камеры. **«Снова live»** возвращает видеопоток.

Сравнение ΔE и подсказка смешивания используют захваченный цвет, если он есть; иначе — live с видео. Можно сравнить захват одной камеры с live другой.

Если камера не открывается, включён **mock-режим** (синтетическое видео) — удобно для разработки UI без двух камер.

## Базовые цвета для подсказки смешивания

Отредактируйте `backend/data/base_colors.json`: снимите каждый тюб/пятно камерой и подставьте измеренные RGB.

## Что изучать во frontend (React)

- `frontend/src/App.tsx` — состояние, `useEffect`, опрос API
- `frontend/src/components/` — разбиение на компоненты
- `frontend/src/api.ts` — типы и запросы к бэкенду
- [React docs](https://react.dev/learn)
- [Vite guide](https://vite.dev/guide/)

## Дальнейшие шаги

- [ ] Перетаскиваемый ROI
- [ ] Калибровка по ColorChecker
- [ ] Запись эталонов палитры из UI
- [ ] Industrial-камеры (отдельный модуль `capture`)
