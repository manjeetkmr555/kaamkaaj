FROM node:20-bookworm-slim AS builder

WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json* ./
RUN npm ci

COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

FROM node:20-bookworm-slim AS runner

WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=builder /app/backend/dist ./dist
COPY database/schema.sql /app/database/schema.sql

ENV DATABASE_URL=postgresql://kaamkaaj:kaamkaaj@database:5432/kaamkaaj
ENV PORT=4000

EXPOSE 4000

CMD ["node", "dist/index.js"]
