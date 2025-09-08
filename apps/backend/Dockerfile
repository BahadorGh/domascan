# Multi-stage Dockerfile for @domascan/backend (hackathon friendly)
FROM node:20-alpine AS base
WORKDIR /app
RUN npm i -g pnpm@9

FROM base AS deps
# Copy root manifests (lock file optional) and workspace definition
COPY package.json ./
COPY pnpm-workspace.yaml ./
COPY pnpm-lock.yaml* ./
COPY .npmrc* ./
COPY prisma ./prisma
COPY apps/backend/package.json apps/backend/
COPY apps/web/package.json apps/web/
# Install all workspace deps so prisma & nest cli are present
RUN pnpm install --frozen-lockfile || pnpm install

FROM deps AS build
COPY . .
# Generate Prisma client & build backend
RUN pnpm exec prisma generate
RUN pnpm --filter @domascan/backend build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN npm i -g pnpm@9

# Copy node_modules and built assets
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/backend/dist ./apps/backend/dist
COPY --from=build /app/prisma ./prisma
COPY package.json pnpm-lock.yaml* ./

# Expose default Nest port
EXPOSE 4000

# Run migrations then start
CMD ["sh","-c","npx prisma migrate deploy && node apps/backend/dist/main.js"]
