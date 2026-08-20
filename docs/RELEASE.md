# Релизы, сборка `.exe` и обновления

## Что собирается

Workflow [`.github/workflows/release.yml`](../.github/workflows/release.yml) выполняет три параллельных этапа и публикацию:

| Job | Runner | Что делает |
|---|---|---|
| `version` | ubuntu | вычисляет semver из тега / имени ветки / ввода вручную |
| `backend` | ubuntu | ставит зависимости, собирает `packages/*` и сервер, генерирует Prisma client, собирает тот же Docker-образ, что и Railway, упаковывает `socialapp-server-<version>.tar.gz` |
| `desktop` | **windows-latest** | проставляет версию, собирает renderer (Vite) и main-процесс (esbuild), запускает electron-builder → NSIS installer + portable `.exe`, затем **проверяет наличие обоих файлов** и падает, если их нет |
| `publish` | ubuntu | создаёт/обновляет GitHub Release и прикрепляет артефакты (`fail_on_unmatched_files: true`) |

Итог релиза:

```
SocialApp 1.0.0
 ├── SocialApp-Setup-1.0.0.exe        NSIS-установщик (ярлыки + uninstall)
 ├── SocialApp-Portable-1.0.0.exe     portable-версия без установки
 ├── latest.yml                       манифест для electron-updater
 ├── *.blockmap                       дельта-обновления
 └── socialapp-server-1.0.0.tar.gz    собранный backend
```

## Как запустить релиз

```bash
# 1) тег (основной способ)
node scripts/set-version.mjs 1.0.0
git commit -am "chore: release 1.0.0"
git tag v1.0.0
git push origin main --tags

# 2) release-ветка (когда нет прав на теги)
git push origin HEAD:release/v1.0.0

# 3) вручную
# GitHub → Actions → Release → Run workflow → version = 1.0.0
```

Версия из тега/ветки/ввода прогоняется через `scripts/set-version.mjs`, поэтому версия desktop-приложения, инсталлятора, имён файлов и `/version` у backend всегда совпадают.

## Перед первым релизом

Задайте переменную репозитория, иначе клиент будет собран с fallback-адресом:

**Settings → Secrets and variables → Actions → Variables → New repository variable**

```
SOCIALAPP_API_URL = https://<ваш-сервис>.up.railway.app
```

Пользователь всё равно может сменить адрес в **Settings → Server**, но правильный дефолт означает, что после установки приложение работает сразу.

## Локальная сборка (Windows)

```bash
npm install
npm run build:packages
set SOCIALAPP_API_URL=https://your-api.up.railway.app   # PowerShell: $env:SOCIALAPP_API_URL="..."
npm run package:win -w @socialapp/desktop
```

Артефакты появятся в `apps/desktop/release/`. Промежуточные варианты:

```bash
npm run build -w @socialapp/desktop      # renderer + main, без упаковки
npm run pack:dir -w @socialapp/desktop   # распакованная сборка (win-unpacked) для быстрой проверки
```

## Подпись кода (опционально)

Без сертификата Windows SmartScreen покажет предупреждение при первом запуске — это нормально для неподписанных сборок. Если есть сертификат, добавьте в секреты репозитория `CSC_LINK` (base64 `.pfx`) и `CSC_KEY_PASSWORD`: electron-builder подхватит их автоматически.

## Авто-обновление

Проект уже совместим со схемой `GitHub Release → новый EXE → обновление`:

* `electron-builder.yml` содержит `publish: github` (`zephyrion-vpn/socialapp`), поэтому каждый релиз содержит `latest.yml`.
* Main-процесс использует `electron-updater`: проверка версии, событие в UI, загрузка по запросу пользователя, установка через `quitAndInstall`.
* Renderer показывает баннер «Версия X доступна → Download → Restart now», статус приходит по IPC-каналу `updates:status`.
* Автозагрузка выключена (`autoDownload = false`) — обновление скачивается только после подтверждения.
* В dev-режиме и в portable-сборке апдейтер отключён и сообщает `disabled`.

Чтобы выпустить обновление, достаточно повторить релиз с большей версией: установленные клиенты увидят его при следующей проверке (по умолчанию — при старте, если включено в настройках).

## Проверки в CI

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) на каждый push/PR:

1. `npm run lint` (ESLint по всему монорепозиторию)
2. `npm run typecheck` (строгий TypeScript)
3. `prisma migrate deploy` против сервиса `postgres:16-alpine`
4. `npm test` (интеграционные тесты API)
5. сборка backend и Docker-образа
6. отдельная job на `windows-latest`: сборка desktop и проверка появления `SocialApp.exe` в `win-unpacked`

Release-workflow намеренно не зависит от CI: даже если тесты упали, релизная сборка `.exe` остаётся воспроизводимой и предсказуемой.
