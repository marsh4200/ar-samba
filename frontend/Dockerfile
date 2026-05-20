## Stage 1 — build
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json ./
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build

## Stage 2 — serve with nginx
FROM nginx:1.27-alpine

# SambaControl's nginx config (proxies /api -> backend:9913, serves SPA)
COPY nginx/sambacontrol.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 9912

# A non-root nginx in alpine already runs unprivileged for the workers;
# master still needs root to bind <1024 (we use 9912 so this is fine).
CMD ["nginx", "-g", "daemon off;"]
