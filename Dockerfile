# --- Build stage: install deps (incl. native better-sqlite3) and build the web UI ---
FROM node:22-bookworm-slim AS build
WORKDIR /app

# Build tools for better-sqlite3's native addon.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# Install workspace dependencies first for better layer caching.
COPY package.json package-lock.json* ./
COPY server/package.json ./server/
COPY web/package.json ./web/
RUN npm install

# Build the frontend.
COPY . .
RUN npm run build --workspace=web

# --- Runtime stage: slim image, server runs the TypeScript directly via tsx ---
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV DATA_DIR=/data
ENV PORT=3000

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/server ./server
COPY --from=build /app/web/dist ./web/dist

VOLUME ["/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# npm runs the script with the workspace dir as cwd, so WEB_DIR (../web/dist) resolves correctly.
CMD ["npm", "start", "--workspace=server"]
