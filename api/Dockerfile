# syntax=docker/dockerfile:1.7

############################
# Stage 1 — install deps
############################
FROM node:20-bookworm-slim AS deps
WORKDIR /app

# Build deps for native modules (bcrypt, sharp, etc. — pulled in by some
# transitive packages). Keep this layer separate so it's cached.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      openssl \
      curl \
      python3 \
      build-essential \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma

# `npmrc` is a BuildKit secret — the project's .npmrc contains a GitHub
# Packages auth token for @cogniahq/integrations. Mounting it as a secret
# keeps the token out of every image layer.
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    npm ci --no-audit --no-fund

############################
# Stage 2 — generate prisma + build TS
############################
FROM deps AS builder
WORKDIR /app

COPY tsconfig.json ./
COPY src ./src

# Prisma client must be generated before tsc runs because services import it.
RUN npx prisma generate
RUN npm run build

############################
# Stage 3 — runtime
############################
FROM node:20-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      openssl \
      curl \
      tini \
  && rm -rf /var/lib/apt/lists/*

# Non-root user. Match nodejs / node from the official image.
RUN groupadd --system --gid 1001 cognia \
 && useradd --system --uid 1001 --gid cognia --create-home cognia

# Copy production node_modules + the generated prisma client out of the deps
# stage. This keeps the image small (no build tools / source TS).
COPY --from=builder --chown=cognia:cognia /app/node_modules ./node_modules
COPY --from=builder --chown=cognia:cognia /app/dist ./dist
COPY --from=builder --chown=cognia:cognia /app/prisma ./prisma
COPY --chown=cognia:cognia package.json package-lock.json ./

# Logs and uploads volumes (created lazily by the app on first write).
RUN mkdir -p /app/logs /app/uploads \
 && chown -R cognia:cognia /app/logs /app/uploads

USER cognia
EXPOSE 3000

# Tini reaps zombies and forwards signals — important because the API spawns
# in-process BullMQ workers that wedge on graceful-shutdown without it.
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/App.js"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:3000/health || exit 1
