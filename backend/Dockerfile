FROM node:20-alpine AS builder
WORKDIR /app

# Install build dependencies for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:20-alpine
WORKDIR /app

# Runtime dependency for better-sqlite3
RUN apk add --no-cache libstdc++

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
RUN mkdir -p /data /app/uploads

ENV NODE_ENV=production
ENV DATABASE_PATH=/data/app.db
ENV UPLOAD_PATH=/app/uploads
ENV PORT=3000
ENV HOST=0.0.0.0

EXPOSE 3000
CMD ["node", "dist/server.js"]
