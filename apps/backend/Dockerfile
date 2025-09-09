# Definitive Dockerfile for pnpm workspaces
# --- Base Stage ---
# Use a specific Node.js version for reproducibility
FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# --- Build Stage ---
# Install dependencies and build the application
FROM base AS build
WORKDIR /app
# Install OS-level dependencies for Prisma
RUN apt-get update && apt-get install -y openssl git

# Copy all source files
COPY . .

# Install all dependencies (dev and prod)
RUN pnpm install --frozen-lockfile --prod=false

# Generate the Prisma Client
# Run Prisma generate with a pinned CLI via pnpm dlx to avoid auto-install
ENV PRISMA_HIDE_UPDATE_MESSAGE=1
RUN cd apps/backend && pnpm dlx prisma@5.22.0 generate --schema=../../prisma/schema.prisma

# Build the NestJS application
RUN pnpm --filter @domascan/backend build

# --- Production Stage ---
# Create the final, small production image
FROM base AS production
WORKDIR /app

# Ensure runtime libs are present (Prisma engines need OpenSSL)
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy package manager files to install production dependencies for backend only
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/backend/package.json ./apps/backend/

# Install only production dependencies for the backend package
RUN pnpm --filter @domascan/backend install --prod

# Copy the built application from the build stage
COPY --from=build /app/apps/backend/dist ./apps/backend/dist
# Copy the generated Prisma client from the build stage next to @prisma/client
COPY --from=build /app/apps/backend/node_modules/.prisma ./apps/backend/node_modules/.prisma

# (Optional) Copy the prisma schema for reference (not required at runtime)
COPY prisma/schema.prisma ./prisma/

# Set the command to run the application
CMD ["node", "apps/backend/dist/main.js"]
