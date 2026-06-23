FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
RUN mkdir -p /data /app/uploads

ENV NODE_ENV=production
ENV DATABASE_PATH=/data/app.db
ENV UPLOAD_PATH=/app/uploads
ENV PORT=3000
ENV JWT_SECRET=change-me-in-production
ENV HOST=0.0.0.0

EXPOSE 3000
CMD ["node", "dist/server.js"]
