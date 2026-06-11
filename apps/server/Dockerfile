FROM node:22-bookworm-slim AS deps

WORKDIR /app

COPY package*.json ./
COPY apps/client/package.json ./apps/client/package.json
COPY apps/server/package.json ./apps/server/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN npm ci --include=dev --workspace apps/server

FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY apps/server ./apps/server
COPY packages/shared ./packages/shared

RUN npm run build --workspace apps/server

FROM node:22-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

COPY package*.json ./
COPY apps/client/package.json ./apps/client/package.json
COPY apps/server/package.json ./apps/server/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN npm ci --omit=dev --workspace apps/server && npm cache clean --force

COPY --from=build /app/apps/server/dist ./apps/server/dist

EXPOSE 5000

CMD ["node", "apps/server/dist/server.js"]
