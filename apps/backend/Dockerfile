# Definitive Dockerfile for pnpm workspaces
FROM node:20-alpine AS base
# Install OpenSSL for Prisma and git for any git-based dependencies
RUN apk add --no-cache openssl git
WORKDIR /app
# Use corepack to manage pnpm, which is the standard for Node.js
RUN corepack enable && corepack prepare pnpm@9 --activate

# --- Dependencies Stage ---
# This stage installs ALL dependencies for the entire workspace
FROM base AS deps
WORKDIR /app
# Copy all manifests and lockfile
COPY package.json pnpm-workspace.yaml ./
# Use a wildcard for .npmrc and pnpm-lock.yaml in case they don't exist
COPY .npmrc* pnpm-lock.yaml* ./
# Copy package.json from all workspaces to ensure correct dependency resolution
COPY apps/backend/package.json ./apps/backend/
COPY apps/web/package.json ./apps/web/
# Install all dependencies (dev and prod)
RUN pnpm install --frozen-lockfile --prod=false

# --- Build Stage ---
# This stage builds the backend application
FROM deps AS build
WORKDIR /app
# Copy the entire source code over the installed dependencies
COPY . .
# Generate the Prisma Client. It will be placed in the root node_modules.
RUN ./node_modules/.bin/prisma generate --schema=./prisma/schema.prisma
# Build the NestJS application
RUN pnpm --filter @domascan/backend build

# --- Production Stage ---
# This stage creates the final, lean image for deployment
FROM base AS production
WORKDIR /app
ENV NODE_ENV=production
# Copy manifests and install ONLY production dependencies
COPY package.json pnpm-workspace.yaml ./
COPY .npmrc* pnpm-lock.yaml* ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --prod
# Copy the built application from the build stage
COPY --from=build /app/apps/backend/dist ./apps/backend/dist
# Copy the prisma schema for runtime migrations
COPY --from=build /app/prisma ./prisma
# Copy the generated Prisma Client from the root node_modules in the build stage
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 4000
# The final command runs from the root, using npx to find the prisma binary
CMD ["sh", "-c", "npx prisma migrate deploy --schema=prisma/schema.prisma && node apps/backend/dist/main.js"]