# Simplified, more robust Dockerfile for @domascan/backend
FROM node:20-alpine AS base
# Install OpenSSL for Prisma and git for pnpm overrides
RUN apk add --no-cache openssl git
WORKDIR /app
# Use corepack to manage pnpm
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# --- Build Stage ---
# This stage installs all dependencies and builds the application
FROM base as build
WORKDIR /app
COPY .npmrc package.json pnpm-workspace.yaml ./
COPY pnpm-lock.yaml* ./
COPY prisma ./prisma
COPY apps/backend/package.json ./apps/backend/
COPY apps/web/package.json ./apps/web/

# Install ALL dependencies (dev and prod)
RUN pnpm install --frozen-lockfile --prod=false || pnpm install --prod=false

# Copy the rest of the source code
COPY . .

# Generate Prisma Client using the direct path to the binary
RUN ./node_modules/.bin/prisma generate --schema=./prisma/schema.prisma

# Build the NestJS app
RUN pnpm --filter @domascan/backend build

# --- Production Stage ---
# This stage creates the final, lean image
FROM base AS production
WORKDIR /app
ENV NODE_ENV=production

# Copy production-only dependencies from a fresh install
COPY .npmrc package.json pnpm-workspace.yaml ./
COPY pnpm-lock.yaml* ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --prod

# Copy the built application and necessary assets from the build stage
COPY --from=build /app/apps/backend/dist ./apps/backend/dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 4000
# Use npx to find the prisma binary in the production node_modules
CMD ["sh", "-c", "npx prisma migrate deploy --schema=prisma/schema.prisma && node apps/backend/dist/main.js"]