FROM node:22-bookworm-slim AS build

WORKDIR /app

ARG VITE_API_BASE_URL=http://localhost:5000/api
ARG VITE_SOCKET_URL=http://localhost:5000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL

COPY package*.json ./
COPY apps/client/package.json ./apps/client/package.json
COPY apps/server/package.json ./apps/server/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN npm ci --include=dev --workspace apps/client
RUN npm install --workspace apps/client --no-save @rolldown/binding-linux-x64-gnu@1.0.3 lightningcss-linux-x64-gnu@1.32.0

COPY apps/client ./apps/client
COPY packages/shared ./packages/shared

RUN npm run build --workspace apps/client

FROM nginx:1.27-alpine AS runtime

COPY apps/client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/client/dist /usr/share/nginx/html

EXPOSE 80
