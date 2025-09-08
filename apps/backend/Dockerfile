# Definitive Dockerfile using npm for install but providing pnpm for Prisma CLI
FROM node:20-alpine AS base
# Install OpenSSL for Prisma and enable pnpm via corepack for the Prisma CLI
RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

# --- Build Stage ---
FROM base AS build
WORKDIR /app

# Copy manifests and schema
COPY package.json ./
COPY apps/backend/package.json ./apps/backend/
COPY prisma/schema.prisma ./prisma/

# Install dependencies for the backend only
WORKDIR /app/apps/backend
RUN npm install --no-audit --no-fund

# Copy the rest of the source code
WORKDIR /app
COPY . .

# Generate Prisma Client, executing from the correct directory
WORKDIR /app/apps/backend
RUN npx prisma generate --schema=../../prisma/schema.prisma

# Build the NestJS app
RUN npx nest build

# --- Production Stage ---
FROM base AS production
WORKDIR /app
ENV NODE_ENV=production

# Install production dependencies only
COPY package.json ./
COPY apps/backend/package.json ./apps/backend/
WORKDIR /app/apps/backend
RUN npm install --omit=dev --no-audit --no-fund

# Copy built app and necessary assets from the build stage
WORKDIR /app
COPY --from=build /app/apps/backend/dist ./apps/backend/dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/apps/backend/node_modules/.prisma ./apps/backend/node_modules/.prisma

EXPOSE 4000
CMD ["sh", "-c", "cd /app/apps/backend && npx prisma migrate deploy --schema=../../prisma/schema.prisma && node dist/main.js"]