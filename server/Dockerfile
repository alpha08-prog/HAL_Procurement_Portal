FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install netcat for network checking in entrypoint
RUN apk add --no-cache netcat-openbsd

# Copy server package files and install dependencies
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm install --omit=dev

# Copy server source code
COPY server/ /app/server/

# Copy AI outputs folder (used by server/routes/ai.js)
COPY ai/ /app/ai/

# Create persistent storage folder and set entrypoint permissions
RUN mkdir -p /app/uploads && \
    chmod +x /app/server/docker-entrypoint.sh

EXPOSE 3001

ENTRYPOINT ["/app/server/docker-entrypoint.sh"]
CMD ["node", "index.js"]
