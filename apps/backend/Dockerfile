# Final, simplified Dockerfile using npm to avoid pnpm workspace issues
FROM node:20-alpine AS base
# Install OpenSSL for Prisma
RUN apk add --no-cache openssl
WORKDIR /app

# --- Build Stage ---
FROM base AS build
WORKDIR /app

# Copy manifests and schema
COPY package.json ./
COPY apps/backend/package.json ./apps/backend/
COPY prisma/schema.prisma ./prisma/

# Install dependencies for the backend only
# This is simpler than a full workspace install
RUN npm install --prefix ./apps/backend --no-audit --no-fund

# Copy the rest of the source code
COPY . .

# Generate Prisma Client
# We need to tell it where the schema is relative to the execution directory
RUN cd apps/backend && npx prisma generate --schema=../../prisma/schema.prisma

# Build the NestJS app
RUN cd apps/backend && npx nest build

# --- Production Stage ---
FROM base AS production
WORKDIR /app
ENV NODE_ENV=production

# Install production dependencies only
COPY package.json ./
COPY apps/backend/package.json ./apps/backend/
RUN npm install --prefix ./apps/backend --omit=dev --no-audit --no-fund

# Copy built app and necessary assets from the build stage
COPY --from=build /app/apps/backend/dist ./apps/backend/dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/apps/backend/node_modules/.prisma ./apps/backend/node_modules/.prisma

EXPOSE 4000
CMD ["sh", "-c", "cd apps/backend && npx prisma migrate deploy --schema=../../prisma/schema.prisma && node dist/main.js"]