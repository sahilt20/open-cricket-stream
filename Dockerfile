# syntax=docker/dockerfile:1.7
#
# open-cricket-stream — multi-target Dockerfile.
#
# Targets:
#   engine  → score-engine production image (Node 20 + better-sqlite3 native build)
#   pwa     → scoring-pwa static build served by nginx
#
# Build:
#   docker build --target=engine -t ocs-engine .
#   docker build --target=pwa    -t ocs-pwa    .
#
# Both targets share the install + @ocs/db build stages so layer cache is reused
# across the two images.

ARG NODE_VERSION=20-bookworm-slim

# ─────────────────────────────────────────────────────────────────────────────
# Stage: base — system deps for native modules
# ─────────────────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS base
WORKDIR /app
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# ─────────────────────────────────────────────────────────────────────────────
# Stage: deps — install all workspace dependencies (cached on manifest changes)
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/db/package.json packages/db/tsconfig.json ./packages/db/
COPY packages/score-engine/package.json packages/score-engine/tsconfig.json ./packages/score-engine/
COPY packages/scoring-pwa/package.json \
     packages/scoring-pwa/tsconfig.json \
     packages/scoring-pwa/tsconfig.app.json \
     packages/scoring-pwa/tsconfig.node.json \
     packages/scoring-pwa/vite.config.ts \
     packages/scoring-pwa/tailwind.config.ts \
     packages/scoring-pwa/postcss.config.js \
     packages/scoring-pwa/index.html \
     ./packages/scoring-pwa/
COPY packages/overlay-templates ./packages/overlay-templates
RUN npm ci

# ─────────────────────────────────────────────────────────────────────────────
# Stage: db-build — compile @ocs/db (engine and PWA both depend on it)
# ─────────────────────────────────────────────────────────────────────────────
FROM deps AS db-build
COPY packages/db/src ./packages/db/src
RUN npm run build --workspace=@ocs/db

# ─────────────────────────────────────────────────────────────────────────────
# Stage: engine-build — compile @ocs/score-engine
# ─────────────────────────────────────────────────────────────────────────────
FROM db-build AS engine-build
COPY packages/score-engine/src ./packages/score-engine/src
RUN npm run build --workspace=@ocs/score-engine \
 && npm prune --omit=dev

# ─────────────────────────────────────────────────────────────────────────────
# Target: engine — lean runtime (no compilers, dev deps pruned)
# ─────────────────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS engine
LABEL org.opencontainers.image.source="https://github.com/sahilt20/open-cricket-stream"
LABEL org.opencontainers.image.description="open-cricket-stream score engine"
LABEL org.opencontainers.image.licenses="MIT"

RUN groupadd --system --gid 10001 ocs \
 && useradd --system --uid 10001 --gid 10001 --no-create-home --home-dir /app --shell /usr/sbin/nologin ocs \
 && install -d -o ocs -g ocs /var/ocs /var/ocs/score-in /var/ocs/overlay-out /var/ocs/recordings

WORKDIR /app
COPY --from=engine-build --chown=ocs:ocs /app /app
USER ocs
WORKDIR /app/packages/score-engine

ENV NODE_ENV=production \
    PORT=8080 \
    DB_PATH=/var/ocs/match.sqlite \
    OVERLAY_OUT_DIR=/var/ocs/overlay-out \
    PCS_PRO_WATCH_DIR=/var/ocs/score-in \
    LOG_LEVEL=info

EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:8080/healthz').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]

# ─────────────────────────────────────────────────────────────────────────────
# Stage: pwa-build — compile @ocs/scoring-pwa
# ─────────────────────────────────────────────────────────────────────────────
FROM db-build AS pwa-build
COPY packages/scoring-pwa/src ./packages/scoring-pwa/src
ARG VITE_ENGINE_URL=http://localhost:8080
ARG VITE_SUPABASE_URL=
ARG VITE_SUPABASE_ANON_KEY=
ENV VITE_ENGINE_URL=${VITE_ENGINE_URL} \
    VITE_SUPABASE_URL=${VITE_SUPABASE_URL} \
    VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
RUN npm run build --workspace=@ocs/scoring-pwa

# ─────────────────────────────────────────────────────────────────────────────
# Target: pwa — nginx serving the built SPA
# ─────────────────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS pwa
LABEL org.opencontainers.image.source="https://github.com/sahilt20/open-cricket-stream"
LABEL org.opencontainers.image.description="open-cricket-stream scoring PWA"
LABEL org.opencontainers.image.licenses="MIT"

COPY --from=pwa-build /app/packages/scoring-pwa/dist /usr/share/nginx/html
COPY docker/scoring-pwa.nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
# No HEALTHCHECK on the PWA image — nginx:alpine ships busybox wget which has
# trouble probing 127.0.0.1 reliably, and a healthcheck on a static-asset server
# adds little signal. Liveness is observable via the host port mapping.
