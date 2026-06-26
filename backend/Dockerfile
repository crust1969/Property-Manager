FROM node:20-alpine
WORKDIR /app

# Install build dependencies for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++ libstdc++

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

RUN mkdir -p /data /app/uploads

ENV NODE_ENV=production
ENV DATABASE_PATH=/data/app.db
ENV UPLOAD_PATH=/app/uploads
ENV PORT=3000
ENV HOST=0.0.0.0

EXPOSE 3000
CMD ["npx", "tsx", "src/server.ts"]
