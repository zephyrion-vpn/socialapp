# Деплой backend на Railway

Пошаговая инструкция: от пустого проекта до работающего production API URL, к которому подключается Windows-клиент.

```
Windows .exe  ──HTTPS──▶  Railway service (Docker)  ──▶  Railway PostgreSQL
                                   │
                                   ├──▶ Railway Redis (опционально)
                                   └──▶ S3 / Cloudflare R2 (картинки)
```

---

## 1. Создать проект и базу

1. [railway.app](https://railway.app) → **New Project**.
2. **+ Create → Database → Add PostgreSQL**. Railway создаст сервис `Postgres` с переменной `DATABASE_URL`.
3. (Опционально) **+ Create → Database → Add Redis** — нужен только для распределённого rate limiting и кэша. Без него сервер работает на in-memory лимитах.

## 2. Добавить сервис backend

1. **+ Create → GitHub Repo → `zephyrion-vpn/socialapp`**.
2. Railway прочитает `railway.json` в корне и соберёт образ по `docker/Dockerfile` (multi-stage build: сборка TypeScript → минимальный runtime-образ с Prisma). Ничего настраивать вручную не нужно.
3. Если Railway предложил другой builder — в **Settings → Build** выберите **Dockerfile** и путь `docker/Dockerfile`.

> Root directory оставьте пустым: сборка идёт из корня монорепозитория, потому что backend использует `packages/shared`.

## 3. Переменные окружения

**Variables** сервиса backend:

```bash
# обязательные
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_ACCESS_SECRET=<64 hex-символа, сгенерируйте локально>
NODE_ENV=production

# опционально
REDIS_URL=${{Redis.REDIS_URL}}
JWT_ACCESS_TTL=15m
REFRESH_TOKEN_TTL_DAYS=30
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=300
LOG_LEVEL=info
TRUST_PROXY=1
```

Сгенерировать секрет:

```bash
openssl rand -hex 32          # или: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`PORT` Railway задаёт сам — сервер слушает именно его. Не задавайте `PORT` вручную.

> `${{Postgres.DATABASE_URL}}` — ссылка Railway на переменную другого сервиса. Настоящие значения не попадают в репозиторий: в git лежит только `.env.example`.

## 4. Object storage для картинок (media)

Файловая система Railway эфемерна, поэтому изображения хранятся во внешнем S3-совместимом хранилище. Без этих переменных API работает, но загрузка медиа возвращает `503 MEDIA_STORAGE_NOT_CONFIGURED`.

Пример для **Cloudflare R2**:

```bash
STORAGE_PROVIDER=r2
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=socialapp-media
S3_ACCESS_KEY_ID=<key>
S3_SECRET_ACCESS_KEY=<secret>
S3_PUBLIC_BASE_URL=https://media.example.com   # публичный домен бакета
S3_FORCE_PATH_STYLE=true
```

Пример для **AWS S3**:

```bash
STORAGE_PROVIDER=s3
S3_REGION=eu-central-1
S3_BUCKET=socialapp-media
S3_ACCESS_KEY_ID=<key>
S3_SECRET_ACCESS_KEY=<secret>
```

Ключи файлов сервер формирует сам в namespace `post/<userId>/…`, `avatar/<userId>/…`, `banner/<userId>/…` и проверяет их принадлежность — клиент не может подставить чужой ключ.

## 5. Домен и проверка

1. **Settings → Networking → Generate Domain**.
2. Полученный адрес (например `https://socialapp-api-production.up.railway.app`) — это ваш production API URL.
3. Проверьте:

```bash
curl https://<домен>/health     # {"status":"ok", "checks": {"database":"ok", ...}}
curl https://<домен>/version    # {"name":"socialapp-server","version":"1.0.0"}
```

`/health/ready` отдаёт `503`, пока недоступна база — Railway использует его как healthcheck и не переключает трафик на нерабочий контейнер.

## 6. Миграции и seed

Миграции применяются **автоматически** при каждом старте контейнера (`prisma migrate deploy` перед запуском сервера). Отключить: `SKIP_MIGRATIONS=1`.

Демо-данные (5 пользователей, посты, подписки, лайки):

```bash
npm i -g @railway/cli
railway login
railway link                     # выбрать проект и сервис backend
railway run npm run seed
```

Пароль демо-пользователей задаётся `SEED_PASSWORD` (по умолчанию `Password123`). **В production сначала смените его или не запускайте seed вообще.**

## 7. Связать desktop-клиент с сервером

Два способа, оба без правки кода:

1. **На этапе сборки:** GitHub → **Settings → Secrets and variables → Actions → Variables → New variable**
   `SOCIALAPP_API_URL = https://<домен>` — значение вшивается в `.exe` как адрес по умолчанию.
2. **В приложении:** экран входа → кнопка `Server: …`, либо **Settings → Server** → вставить URL → **Save and test**. Адрес сохраняется в профиле пользователя Windows и переживает перезапуск.

## 8. Эксплуатация

| Задача | Как |
|---|---|
| Логи | Railway → сервис → **Deployments → View logs** (структурированный JSON с `requestId`) |
| Масштабирование | Railway → **Settings → Resources**; сервер stateless, реплики можно увеличивать (для общего rate limiting задайте `REDIS_URL`) |
| Бэкапы БД | Railway → Postgres → **Backups** |
| Откат релиза | Railway → **Deployments → Redeploy** нужного коммита |
| Ротация JWT-секрета | смените `JWT_ACCESS_SECRET` — все access-токены станут невалидны, клиенты автоматически переполучат их по refresh-токену |
| Полный logout всех | смена пароля или `POST /auth/logout-all` от имени пользователя |

## Типовые проблемы

| Симптом | Причина и решение |
|---|---|
| `502` от Railway | контейнер упал на старте — почти всегда неверный `DATABASE_URL` или отсутствует `JWT_ACCESS_SECRET` в production. Смотрите логи |
| `/health` отвечает, но `checks.database = "error"` | БД не поднялась или не применены миграции — проверьте логи `prisma migrate deploy` |
| Приложение пишет «Cannot reach the server» | неверный API URL в клиенте (**Settings → Server**) либо сервис Railway остановлен |
| `503 MEDIA_STORAGE_NOT_CONFIGURED` при загрузке картинки | не заданы переменные `STORAGE_PROVIDER` / `S3_*` |
| `429` | сработал rate limiting; увеличьте `RATE_LIMIT_MAX` или подключите Redis |
| Долгий первый ответ | cold start после деплоя — это нормально, healthcheck ждёт готовности |
