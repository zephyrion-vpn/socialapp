<div align="center">

# SocialApp

**Аналог Threads + X (Twitter): production-ready backend на Railway и настоящее устанавливаемое Windows-приложение (`.exe`).**

```
Windows .exe  ──HTTPS──▶  Backend on Railway  ──▶  PostgreSQL (+ Redis, S3)
  (клиент)                   (работает 24/7)
```

</div>

---

## Ключевая идея архитектуры

Проект состоит из **двух полностью независимых частей**:

| | SERVER | DESKTOP |
|---|---|---|
| Что это | Node.js + TypeScript + Express + Prisma + PostgreSQL | Electron + React + TypeScript |
| Где живёт | Railway (Docker) | Компьютер пользователя |
| Как запускается | постоянно, независимо от клиента | `SocialApp-Setup-1.0.0.exe` → «Пуск» / ярлык на рабочем столе |
| Что знает о другой части | ничего, кроме HTTPS-запросов от клиентов | только базовый API URL |

> **`.exe` — это только клиент.** Приложение **никогда** не запускает backend локально: в нём нет ни сервера, ни базы данных, ни серверных секретов. Вся авторизация, валидация и бизнес-логика выполняются на сервере.

---

## Структура репозитория

```
/
├── apps/
│   ├── desktop/                 Electron + React + TypeScript (Windows .exe)
│   │   ├── electron/            main process, preload, IPC, безопасное хранилище, updater, меню
│   │   ├── src/                 renderer: экраны, компоненты, роутер, стор, дизайн-система
│   │   ├── scripts/             сборка main-процесса, генерация иконки, dev-раннер
│   │   └── electron-builder.yml NSIS installer + portable .exe
│   └── server/                  REST API (Express 5, Zod, Prisma)
│       ├── prisma/              schema.prisma, migrations, seed
│       ├── src/                 routes, services, middleware, lib
│       └── tests/               интеграционные тесты (Vitest + Supertest)
├── packages/
│   ├── shared/                  типы, Zod-схемы, константы, утилиты (общие для сервера и клиента)
│   └── api-client/              типизированный API-клиент (fetch, авто-refresh токена)
├── docker/                      Dockerfile (Railway) + docker-compose для локальной разработки
├── docs/                        RAILWAY.md, RELEASE.md
├── scripts/set-version.mjs      единая версия для всех package.json
├── .github/workflows/           ci.yml (lint/typecheck/tests/build) и release.yml (сборка .exe)
├── railway.json                 конфигурация деплоя Railway
└── .env.example                 все переменные окружения (без секретов)
```

---

## Что уже реализовано

### Backend (`apps/server`)

* **Авторизация:** регистрация, вход по email или username, logout, logout со всех устройств, access-токены (JWT, 15 мин) + refresh-токены (30 дней, ротация, хранятся только в виде SHA-256 хэша), восстановление пароля по одноразовому токену, смена пароля с отзывом остальных сессий, bcrypt (cost 12).
* **Соцсеть:** профили, посты (до 500 символов), ответы (threads с ancestors), репосты, лайки, закладки, подписки, блокировки, mute, уведомления, хэштеги, тренды, поиск по постам/людям/хэштегам.
* **Лента:** cursor pagination, 4 стратегии — `home` (подписки), `recommended`, `popular` (hot-ranking за 48 часов), `latest`. Алгоритм вынесен в `feed.service.ts`, чтобы позже заменить его на полноценный recommendation engine.
* **Media:** загрузка изображений в S3-совместимое object storage (S3 / Cloudflare R2 / MinIO) — файлы **не** пишутся в файловую систему Railway. Поддержаны прямой multipart-upload через сервер и presigned upload-ticket.
* **Безопасность:** Helmet, CORS-allowlist, строгая валидация всех входных данных через Zod, rate limiting (общий, отдельные лимиты для auth/записи/загрузок), проверка прав на каждом endpoint, namespace-проверка ключей в storage, request-id в логах, никакого доверия данным клиента.
* **Операции:** `/health`, `/health/live`, `/health/ready`, `/version`, graceful shutdown, корректное использование `PORT`, Prisma-миграции при старте контейнера, seed с демо-данными.

### Desktop (`apps/desktop`)

* Настоящий Windows-инсталлятор **NSIS** (`SocialApp-Setup-1.0.0.exe`): ярлык на рабочем столе, пункт в меню «Пуск», запись в «Установка и удаление программ», аккуратный uninstall. Плюс **portable** `SocialApp-Portable-1.0.0.exe`.
* Иконка приложения, метаданные, единая версия, `latest.yml` + `electron-updater` — совместимо со схемой `GitHub Release → новый EXE → обновление`.
* Интерфейс социальной сети, а не «сайт в окне»: sidebar, лента с 4 вкладками, композер, thread-view, профиль (posts/replies/media/likes), уведомления, поиск, тренды, закладки, настройки.
* Dark / light / системная тема, плотность интерфейса, hover-состояния, skeleton-загрузки, empty/error states, тосты, offline-баннер, нативные Windows-уведомления, badge на иконке.
* Клавиатура: `N` — новый пост, `/` — поиск, `R` — обновить, `G+H/E/N/B/S` — навигация, `Ctrl+Enter` — отправить, `?` — список шорткатов, плюс нативное меню.
* **Безопасность клиента:** `contextIsolation`, `sandbox`, отключённый `nodeIntegration`, CSP, блокировка сторонней навигации, внешние ссылки открываются в системном браузере. Токены хранятся через `safeStorage` (Windows DPAPI) в зашифрованном файле — **никогда** в plaintext и не в localStorage.

---

## Быстрый старт (разработка)

```bash
git clone https://github.com/zephyrion-vpn/socialapp.git
cd socialapp
npm install
cp .env.example .env                      # заполните локальные значения

# 1. PostgreSQL (+ Redis) локально
docker compose -f docker/docker-compose.yml up -d db redis

# 2. Миграции, клиент Prisma и демо-данные
npm run build:packages
npm run prisma:generate
npm run prisma:migrate
npm run seed                              # ada / grace / linus / margaret / alan, пароль Password123

# 3. API на http://localhost:3000
npm run dev -w @socialapp/server

# 4. Desktop-клиент в dev-режиме (Electron + Vite HMR)
npm run dev -w @socialapp/desktop
```

В dev-режиме клиент по умолчанию идёт на `http://localhost:3000`, в production-сборке — на URL, заданный при сборке. Код при переключении менять не нужно:

```bash
# development
SOCIALAPP_API_URL=http://localhost:3000

# production
SOCIALAPP_API_URL=https://your-production-api.up.railway.app
```

Кроме того, адрес сервера можно поменять прямо в приложении: **Settings → Server** (или на экране входа → кнопка `Server: …`), с проверкой доступности через `/health`.

---

## Деплой backend на Railway (кратко)

1. **New Project → Deploy from GitHub repo** → `zephyrion-vpn/socialapp`.
2. В проект добавить **PostgreSQL** (и, при желании, **Redis** отдельным сервисом).
3. В переменные сервиса добавить как минимум:
   ```
   DATABASE_URL = ${{Postgres.DATABASE_URL}}
   JWT_ACCESS_SECRET = <случайные 64 hex-символа>
   NODE_ENV = production
   ```
4. **Settings → Networking → Generate Domain** — получаем production API URL вида `https://socialapp-api-production.up.railway.app`.
5. Проверить: `curl https://<домен>/health` → `{"status":"ok"}`.

Миграции применяются автоматически при старте контейнера (`prisma migrate deploy`), сборка идёт по `docker/Dockerfile`, healthcheck — `/health`, порт берётся из `PORT`.

**Подробная пошаговая инструкция:** [`docs/RAILWAY.md`](docs/RAILWAY.md) — включая Redis, S3/R2 для медиа, seed, откат миграций и типовые проблемы.

---

## Сборка Windows `.exe`

### Автоматически (GitHub Actions)

Workflow `.github/workflows/release.yml` собирает backend и Windows-клиент и прикрепляет файлы к GitHub Release. Запуск — любым из трёх способов:

```bash
git tag v1.0.0 && git push origin v1.0.0      # 1) тег
git push origin HEAD:release/v1.0.0           # 2) release-ветка
# 3) Actions → Release → Run workflow (ввести версию)
```

Результат в GitHub Release:

```
SocialApp 1.0.0
 ├── SocialApp-Setup-1.0.0.exe        установщик Windows
 ├── SocialApp-Portable-1.0.0.exe     portable-версия
 ├── latest.yml                       метаданные для авто-обновления
 └── socialapp-server-1.0.0.tar.gz    собранный backend
```

> Перед релизом задайте переменную репозитория **Settings → Secrets and variables → Actions → Variables → `SOCIALAPP_API_URL`** = адрес вашего Railway-сервиса. Она вшивается в сборку как API URL по умолчанию.

### Локально (нужен Windows)

```bash
npm install
npm run build:packages
SOCIALAPP_API_URL=https://your-api.up.railway.app npm run package:win
# → apps/desktop/release/SocialApp-Setup-1.0.0.exe
# → apps/desktop/release/SocialApp-Portable-1.0.0.exe
```

Версия проекта меняется одной командой (обновляет все `package.json`, включая desktop):

```bash
node scripts/set-version.mjs 1.1.0
```

Подробнее про релизы и авто-обновление: [`docs/RELEASE.md`](docs/RELEASE.md).

---

## Как пользователь получает приложение

1. Открыть **Releases** репозитория и скачать `SocialApp-Setup-1.0.0.exe`.
2. Установить (обычный установщик Windows, создаст ярлыки).
3. Запустить SocialApp из меню «Пуск».
4. Зарегистрироваться или войти — данные уходят на backend в Railway.
5. Пользоваться соцсетью. Backend продолжает работать, даже когда приложение закрыто.

---

## Переменные окружения

### Backend

| Переменная | Обязательна | По умолчанию | Назначение |
|---|---|---|---|
| `DATABASE_URL` | да | — | PostgreSQL (Railway подставляет автоматически) |
| `JWT_ACCESS_SECRET` | да (prod) | dev-значение | подпись access-токенов, ≥ 32 символа |
| `PORT` | нет | `3000` | Railway задаёт сам |
| `NODE_ENV` | нет | `development` | `production` включает строгие проверки |
| `JWT_ACCESS_TTL` | нет | `15m` | время жизни access-токена |
| `REFRESH_TOKEN_TTL_DAYS` | нет | `30` | время жизни refresh-токена |
| `BCRYPT_ROUNDS` | нет | `12` | стоимость хэширования пароля |
| `REDIS_URL` | нет | — | распределённый rate limiting и кэш |
| `CORS_ORIGINS` | нет | — | список разрешённых origin (desktop-клиенту не нужен) |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | нет | `60000` / `300` | базовый лимит запросов |
| `TRUST_PROXY` | нет | `1` | корректный клиентский IP за прокси Railway |
| `LOG_LEVEL` | нет | `info` | уровень логирования |
| `STORAGE_PROVIDER` | нет | `none` | `none` \| `s3` \| `r2` |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL`, `S3_FORCE_PATH_STYLE` | для медиа | — | object storage для картинок |
| `SKIP_MIGRATIONS` | нет | — | `1` отключает автомиграции при старте |
| `SEED_PASSWORD` | нет | `Password123` | пароль демо-пользователей |

### Desktop

| Переменная | Когда используется | Назначение |
|---|---|---|
| `SOCIALAPP_API_URL` | сборка и запуск | API URL по умолчанию, вшивается в `.exe` |

Секретов backend в desktop-сборке нет и быть не должно: `.exe` распаковывается кем угодно.

---

## API (v1, префикс `/api/v1`)

| Группа | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/logout-all`, `GET /auth/me`, `GET /auth/sessions`, `POST /auth/password/forgot` \| `/reset` \| `/change` |
| Users | `GET/PATCH /users/me`, `GET /users/suggested`, `GET /users/:username`, `GET /users/:username/{posts,replies,reposts,likes,media,followers,following}`, `POST/DELETE /users/:username/{follow,block,mute}` |
| Posts | `POST /posts`, `GET/DELETE /posts/:id`, `GET /posts/:id/{thread,replies,likes}`, `POST/DELETE /posts/:id/{like,repost,bookmark}` |
| Feed | `GET /feed?type=home\|recommended\|popular\|latest&cursor&limit` |
| Discovery | `GET /search?q&type`, `/search/posts`, `/search/users`, `GET /trends`, `/trends/:tag/posts` |
| Notifications | `GET /notifications`, `/notifications/unread-count`, `POST /notifications/read-all`, `POST /notifications/:id/read` |
| Bookmarks | `GET /bookmarks` |
| Media | `POST /media/upload`, `POST /media/upload-url` |
| Служебные | `GET /health`, `/health/live`, `/health/ready`, `/version` (без префикса) |

Все списки возвращают `{ items, nextCursor, hasMore }`, все ошибки — `{ error: { code, message, details?, requestId? } }`.

---

## База данных

15 таблиц с внешними ключами, каскадами, уникальными ограничениями и индексами под запросы ленты:
`User`, `Profile`, `Post`, `PostMedia`, `Like`, `Repost`, `Reply`, `Follow`, `Bookmark`, `Notification`, `Hashtag`, `PostHashtag`, `Block`, `Mute`, `Session` (+ `PasswordResetToken`).

```bash
npm run prisma:migrate     # создать/применить миграцию локально
npm run prisma:deploy      # применить миграции (CI/production)
npm run prisma:studio      # визуальный просмотр данных
```

---

## Тесты и CI

```bash
npm run lint
npm run typecheck
npm test                   # Vitest + Supertest против реального PostgreSQL
```

Покрыто: регистрация, вход, refresh/ротация токенов, смена пароля, создание постов, хэштеги, ответы и thread, лайки, репосты, закладки, подписки, блокировки, уведомления, все 4 режима ленты, cursor pagination, поиск, тренды, health/version.

`.github/workflows/ci.yml` на каждый push и PR: lint → typecheck → миграции → тесты → сборка backend → сборка Docker-образа, и отдельная job на `windows-latest`, которая собирает desktop-клиент и проверяет, что исполняемый файл действительно появился.

---

## Лицензия

MIT — см. [LICENSE](LICENSE).
