# =============================================================================
# SocialApp backend image (server ONLY - the desktop client is never built or
# started here). Build context = repository root.
#   docker build -f docker/Dockerfile -t socialapp-server .
# =============================================================================
FROM node:20-bookworm-slim

ENV NODE_ENV=production \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false

WORKDIR /app

# openssl is required by Prisma engines; curl is used by the container healthcheck
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

# ---- dependencies (cached layer) -------------------------------------------
COPY package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
RUN npm install --include=dev --no-audit --no-fund

# ---- sources ---------------------------------------------------------------
COPY packages/shared packages/shared
COPY apps/server apps/server

# ---- build -----------------------------------------------------------------
RUN npm run build -w @socialapp/shared \
  && npx prisma generate --schema apps/server/prisma/schema.prisma \
  && npm run build -w @socialapp/server \
  && npm prune --omit=dev \
  && npx prisma generate --schema apps/server/prisma/schema.prisma \
  && npm cache clean --force

# Railway injects PORT; the server always reads process.env.PORT.
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT:-3000}/health" || exit 1

# Applies pending SQL migrations, then starts the API. Set SKIP_MIGRATIONS=1 to
# start without running migrations.
CMD ["sh", "-c", "if [ \"$SKIP_MIGRATIONS\" != \"1\" ]; then npx prisma migrate deploy --schema apps/server/prisma/schema.prisma; fi && node apps/server/dist/index.js"]
