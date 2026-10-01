# Stage 1: build the React SPA
FROM node:24-alpine AS builder

WORKDIR /app

COPY client/package*.json ./client/
WORKDIR /app/client
RUN npm install

COPY client/ ./
RUN npm run build

# Stage 2: serve it from nginx with the /api reverse proxy (client/nginx.conf)
FROM nginx:alpine

COPY --from=builder /app/client/dist /usr/share/nginx/html
COPY client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
