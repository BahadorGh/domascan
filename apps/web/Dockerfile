# Build & serve static web via nginx
FROM node:20-alpine AS build
WORKDIR /app
RUN npm i -g pnpm@9
COPY package.json .
COPY pnpm-lock.yaml* ./
COPY pnpm-workspace.yaml ./
COPY .npmrc* ./
COPY apps/web/package.json apps/web/
COPY apps/backend/package.json apps/backend/
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile
COPY . .
# Accept build-time API base override; default now points directly to Koyeb backend
ARG VITE_API_URL=https://orthodox-kiley-bahadorgh-a9181840.koyeb.app
ENV VITE_API_URL=${VITE_API_URL}
RUN pnpm --filter @domascan/web build

FROM nginx:1.27-alpine AS runtime
WORKDIR /usr/share/nginx/html
COPY --from=build /app/apps/web/dist .
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx","-g","daemon off;"]
