# syntax=docker/dockerfile:1.7

############################
# Stage 1 — install deps
############################
FROM node:20-bookworm-slim AS deps
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      python3 \
      build-essential \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

############################
# Stage 2 — build the app
############################
FROM deps AS builder
WORKDIR /app

# Vite inlines VITE_* env vars at build time. The compose file passes them
# through `args:`, then we re-expose them with ENV so npm run build sees them.
ARG VITE_SERVER_URL
ARG VITE_API_URL
ARG VITE_HTTPS_ENABLE=false
ARG VITE_ENABLE_INTERNAL_ROUTES=true
ARG VITE_FIREBASE_API_KEY=
ARG VITE_FIREBASE_AUTH_DOMAIN=
ARG VITE_FIREBASE_PROJECT_ID=

ENV VITE_SERVER_URL=$VITE_SERVER_URL \
    VITE_API_URL=$VITE_API_URL \
    VITE_HTTPS_ENABLE=$VITE_HTTPS_ENABLE \
    VITE_ENABLE_INTERNAL_ROUTES=$VITE_ENABLE_INTERNAL_ROUTES \
    VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY \
    VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN \
    VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID

COPY tsconfig*.json vite.config.ts tailwind.config.js postcss.config.js components.json ./
COPY public ./public
COPY index.html ./
COPY src ./src

RUN npm run build

############################
# Stage 3 — nginx runtime
############################
FROM nginx:1.27-alpine AS runtime

# Tiny image: just serves dist + reverse-proxies API calls to the api service.
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# Drop the default nginx stub server, use our config above.
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1
