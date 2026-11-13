FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build
EXPOSE 8787
CMD ["node","--import","./scripts/sites-env.mjs","./node_modules/wrangler/bin/wrangler.js","dev","--config","dist/server/wrangler.json","--local","--ip","0.0.0.0","--port","8787","--inspector-port","0"]
