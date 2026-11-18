# KeyGo customer app, web version: exported by Expo and served as static files by Nginx.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npx expo export --platform web --output-dir dist

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
# The listen port comes from CUSTOMER_PORT in docker-compose (bound to 127.0.0.1 on the VPS)
