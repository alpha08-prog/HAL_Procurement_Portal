# Stage 1: Build React SPA
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package specifications and install dependencies
COPY client/package*.json ./client/
WORKDIR /app/client
RUN npm install

# Copy frontend source code and compile production build
COPY client/ ./
RUN npm run build

# Stage 2: Production Nginx Server
FROM nginx:alpine

# Copy compiled static assets from builder stage
COPY --from=builder /app/client/dist /usr/share/nginx/html

# Copy custom Nginx configuration with SPA fallback and API reverse proxy
COPY client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
