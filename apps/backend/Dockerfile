# Final, most robust Dockerfile
FROM node:20-alpine AS base
# Install OpenSSL for Prisma
RUN apk add --no-cache openssl
WORKDIR /app

# --- Build Stage ---
FROM base AS build
WORKDIR /app

# Copy only necessary manifests and schema
COPY package.json ./
COPY apps/backend/package.json ./apps/backend/
COPY prisma/schema.prisma ./prisma/

# Install dependencies for the backend. This is the most crucial step.
# By setting the WORKDIR first, all subsequent commands run in this context.
WORKDIR /app/apps/backend
RUN npm install --no-audit --no-fund

# Now, copy the rest of the source code into the root
WORKDIR /app
COPY . .

# Generate Prisma Client, executing from the correct directory
# The schema path is now relative to the /app/apps/backend directory
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
# Copy the generated client from the build stage's node_modules
COPY --from=build /app/apps/backend/node_modules/.prisma ./apps/backend/node_modules/.prisma

EXPOSE 4000
# The final command also runs from the correct directory
CMD ["sh", "-c", "cd /app/apps/backend && npx prisma migrate deploy --schema=../../prisma/schema.prisma && node dist/main.js"]