# Node >= 22.5 is required for the built-in node:sqlite used by the noting, contracts,
# approvals and AI-case stores. Dev runs on Node 24, so the image matches.
FROM node:24-alpine

WORKDIR /app

# Server dependencies
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm install --omit=dev

# Server source, plus the ai/ folder it reads at runtime (prompts.json, case_input.json,
# fixtures, dop2025.json and the CLI's outputs/ if present).
COPY server/ /app/server/
COPY ai/ /app/ai/

# SQLite files and binary uploads live under these two folders; both are mounted as
# named volumes in docker-compose.yml so they survive container rebuilds.
RUN mkdir -p /app/server/data /app/server/uploads

EXPOSE 3001

CMD ["node", "index.js"]
