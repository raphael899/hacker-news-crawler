# syntax=docker/dockerfile:1
ARG NODE_VERSION=24.15.0

# pnpm comes from Corepack, pinned by the packageManager field in package.json.
FROM node:${NODE_VERSION}-alpine AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /app
RUN corepack enable

# All dependencies, used to build and test.
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Full source tree for `docker compose run --rm test`.
FROM deps AS test
COPY . .
CMD ["pnpm", "test:coverage"]

FROM deps AS build
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN pnpm build

FROM base AS prod-deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod

# Runtime image: compiled JavaScript and production dependencies only.
FROM node:${NODE_VERSION}-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --chown=node:node package.json ./
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 3000
# Configuration comes from the environment (see docker-compose.yaml), not from a .env file.
CMD ["node", "dist/main.js"]
