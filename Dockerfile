# Build stage
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.6.5 --activate

WORKDIR /app

# Copy workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./

# Copy package.json files for all packages
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/core/package.json ./packages/core/
COPY packages/db/package.json ./packages/db/
COPY packages/inference/package.json ./packages/inference/
COPY packages/tools/package.json ./packages/tools/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build all packages
RUN pnpm build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Copy built output
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/core/package.json ./packages/core/
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/db/package.json ./packages/db/
COPY --from=builder /app/packages/inference/dist ./packages/inference/dist
COPY --from=builder /app/packages/inference/package.json ./packages/inference/
COPY --from=builder /app/packages/tools/dist ./packages/tools/dist
COPY --from=builder /app/packages/tools/package.json ./packages/tools/
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/web/.next/standalone ./apps/web/
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

# Create data directory
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV DATABASE_PATH=/app/data/liminal.db
ENV API_PORT=3001

EXPOSE 3000 3001

# Start both servers
CMD ["sh", "-c", "node apps/api/dist/index.js & node apps/web/server.js"]
