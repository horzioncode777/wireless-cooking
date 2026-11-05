FROM node:22-bookworm-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/index.html frontend/vite.config.js ./
COPY frontend/src ./src
COPY frontend/public ./public
COPY shared /app/shared
ENV VITE_API_URL=""
RUN npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=6001 SERVE_FRONTEND=true
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=node:node backend/src ./src
COPY --chown=node:node backend/db ./db
COPY --chown=node:node backend/scripts/migrate.js backend/scripts/create-admin.js ./scripts/
COPY --chown=node:node backend/demo-assets ./demo-assets
COPY --chown=node:node shared /app/shared
COPY --from=frontend-build --chown=node:node /app/frontend/dist /app/frontend/dist
RUN mkdir -p uploads && chown node:node uploads
USER node
EXPOSE 6001
HEALTHCHECK --interval=30s --timeout=7s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:6001/api/health',{signal:AbortSignal.timeout(6000)}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
