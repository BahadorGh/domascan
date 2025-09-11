# Definitive Dockerfile for pnpm workspaces
# IMPORTANT: Build from the repository root so the prisma/ directory is in the build context.
# Example:
#   docker build -f apps/backend/Dockerfile -t domascan-backend .
# (Running `docker build` from apps/backend will NOT include ../.. /prisma and will fail.)
# --- Base Stage ---
# Use a specific Node.js version for reproducibility
FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV PNPM_STORE_PATH=/pnpm/store
RUN corepack enable

# --- Build Stage ---
# Install dependencies and build the application
FROM base AS build
WORKDIR /app
# Install OS-level dependencies for Prisma
RUN apt-get update && apt-get install -y openssl git

# Copy all source files
COPY . .
# Fail fast if the prisma schema is missing (likely wrong build context)
RUN test -f prisma/schema.prisma || (echo "ERROR: prisma/schema.prisma not found in build context. Run build from repo root with: docker build -f apps/backend/Dockerfile -t domascan-backend ." && exit 1)

# Install all dependencies (dev and prod)
# Allow disabling strict lockfile enforcement for emergency builds
ARG STRICT_LOCKFILE=true
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    if [ "$STRICT_LOCKFILE" = "true" ]; then \
    pnpm install --frozen-lockfile --prod=false; \
    else \
    echo "[WARN] STRICT_LOCKFILE=false -> using --no-frozen-lockfile"; \
    pnpm install --no-frozen-lockfile --prod=false; \
    fi

# Ensure backend workspace dev deps are linked (including prisma CLI)
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm --filter @domascan/backend install --prod=false

# Generate the Prisma Client (run from repo root for workspace resolution)
# Prevent autoinstall noise
ENV PRISMA_HIDE_UPDATE_MESSAGE=1
ENV PRISMA_GENERATE_SKIP_AUTOINSTALL=1
RUN pnpm exec prisma generate --schema=prisma/schema.prisma

# Build the NestJS application
RUN pnpm --filter @domascan/backend build

# --- Production Stage ---
# Create the final, small production image
FROM base AS production
WORKDIR /app

# Ensure runtime libs are present (Prisma engines need OpenSSL)
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=4000

# Copy package manager files to install production dependencies for backend only
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/backend/package.json ./apps/backend/

# Copy prisma schema & migrations BEFORE install so postinstall (or manual) generate sees it
COPY --from=build /app/prisma ./prisma

# Install only production dependencies for the backend package
RUN --mount=type=cache,id=pnpm-store-prod,target=/pnpm/store pnpm --filter @domascan/backend install --prod

## Copy build artifacts
# Built NestJS dist
COPY --from=build /app/apps/backend/dist ./apps/backend/dist
# Copy pre-generated Prisma Client & engines from build stage (pnpm hoisted path)
COPY --from=build /app/node_modules/.pnpm/@prisma+client@*/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=build /app/node_modules/.pnpm/@prisma+client@*/node_modules/.prisma ./node_modules/.prisma

# Optional healthcheck (simple TCP) - adjust to an HTTP endpoint if you add one
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e 'require("net").createConnection(process.env.PORT || 4000, "127.0.0.1").on("error",()=>process.exit(1)).on("connect",c=>{c.end();});'

# Set the command to run the application with runtime migrations (idempotent)
# Uses prisma CLI now present in production dependencies.
CMD ["sh","-c","apps/backend/node_modules/.bin/prisma migrate deploy --schema=prisma/schema.prisma && node apps/backend/dist/main.js"]
