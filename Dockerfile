# ============================================
# Stage 1: Build the web client
# ============================================
FROM node:24-alpine AS builder

RUN apk add --no-cache git python3 make g++

# Install pnpm
RUN corepack enable

WORKDIR /build

# Copy workspace config files for dependency resolution
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./

# Copy all package.json files for workspace packages
COPY packages/stoat.js/package.json packages/stoat.js/
COPY packages/solid-livekit-components/package.json packages/solid-livekit-components/
COPY packages/js-lingui-solid/packages/babel-plugin-lingui-macro/package.json packages/js-lingui-solid/packages/babel-plugin-lingui-macro/
COPY packages/js-lingui-solid/packages/babel-plugin-extract-messages/package.json packages/js-lingui-solid/packages/babel-plugin-extract-messages/
COPY packages/client/package.json packages/client/

# Copy panda config needed by client's "prepare" lifecycle script (panda codegen)
COPY packages/client/panda.config.ts packages/client/

# Install dependencies — cached as long as lockfile doesn't change
RUN pnpm install --frozen-lockfile

# ── Sub-dependencies (change rarely) ─────────────────────────────────────────
# Copy each sub-package source separately so its build layer is only
# invalidated when that package's own files change.

COPY packages/stoat.js/ packages/stoat.js/
RUN pnpm --filter stoat.js build

COPY packages/solid-livekit-components/ packages/solid-livekit-components/
RUN pnpm --filter solid-livekit-components build

COPY packages/js-lingui-solid/ packages/js-lingui-solid/
RUN pnpm --filter @lingui-solid/babel-plugin-lingui-macro build && \
    pnpm --filter @lingui-solid/babel-plugin-extract-messages build

# ── Client source (changes frequently) ───────────────────────────────────────
COPY packages/client/ packages/client/

# Compile translations, copy assets, generate panda CSS
RUN pnpm --filter client exec lingui compile --typescript && \
    pnpm --filter client exec node scripts/copyAssets.mjs && \
    pnpm --filter client exec panda codegen

# Build the client with placeholder env vars for runtime injection
# these are replaced by inject.js at container run startup
ENV VITE_API_URL=__VITE_API_URL__
ENV VITE_WS_URL=__VITE_WS_URL__
ENV VITE_MEDIA_URL=__VITE_MEDIA_URL__
ENV VITE_PROXY_URL=__VITE_PROXY_URL__
ENV VITE_HCAPTCHA_SITEKEY=__VITE_HCAPTCHA_SITEKEY__
ENV VITE_CFG_ENABLE_VIDEO=__VITE_CFG_ENABLE_VIDEO__
ENV BASE_PATH=/

RUN NODE_OPTIONS=--max-old-space-size=4096 pnpm --filter client exec vite build

# ============================================
# Stage 2: Minimal runtime image
# ============================================
FROM node:24-alpine

WORKDIR /app

# Copy the server package and install dependencies
COPY docker/package.json docker/package-lock.json docker/inject.js ./
RUN npm ci --omit=dev

# Copy built static assets from stage 1
COPY --from=builder /build/packages/client/dist ./dist

EXPOSE 5000

# Runtime env vars (overridden by Helm chart / docker run)
ENV VITE_API_URL=""
ENV VITE_WS_URL=""
ENV VITE_MEDIA_URL=""
ENV VITE_PROXY_URL=""
ENV VITE_HCAPTCHA_SITEKEY=""
ENV VITE_CFG_ENABLE_VIDEO=""
ENV REVOLT_PUBLIC_URL=""

CMD ["npm", "start"]
