# Multi-stage Dockerfile for @domascan/backend (hackathon friendly)
FROM node:20-alpine AS base
# Install OpenSSL for Prisma
RUN apk add --no-cache openssl
WORKDIR /app
# Use corepack to manage pnpm
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# --- Dependencies Stage ---
# This stage installs ALL dependencies (dev and prod)
FROM base AS deps
WORKDIR /app
COPY .npmrc package.json pnpm-workspace.yaml ./
COPY pnpm-lock.yaml* ./
COPY prisma ./prisma
COPY apps/backend/package.json ./apps/backend/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile --prod=false || pnpm install --prod=false

# --- Build Stage ---
# This stage uses the dependencies from 'deps' and the source code to build the app
FROM base AS build
WORKDIR /app
# Copy dependencies and source code
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate Prisma client & build backend
# Run from backend scope to find prisma, use relative path for schema
RUN pnpm --filter @domascan/backend exec prisma generate --schema ../../prisma/schema.prisma
RUN pnpm --filter @domascan/backend build

# --- Pruning Stage for Production Dependencies ---
FROM base AS pruner
WORKDIR /app
COPY .npmrc package.json pnpm-workspace.yaml ./
COPY pnpm-lock.yaml* ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/web/package.json ./apps/web/
# Install ONLY production dependencies
RUN pnpm install --prod

# --- Runtime Stage ---
# Final, small image
FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Copy production node_modules from the 'pruner' stage
COPY --from=pruner /app/node_modules ./node_modules
# Copy built application from the 'build' stage
COPY --from=build /app/apps/backend/dist ./apps/backend/dist
# Copy prisma schema and client for runtime
COPY --from=build /app/prisma ./prisma
# Copy necessary package files for runtime execution
COPY package.json apps/backend/package.json ./

EXPOSE 4000
# Use npx to find the prisma binary in the production node_modules
CMD ["sh","-c","npx prisma migrate deploy --schema=prisma/schema.prisma && node apps/backend/dist/main.js"]