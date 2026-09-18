# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
# pnpm puts global binaries in $PNPM_HOME/bin, so both need to be on PATH
ENV PNPM_HOME=/pnpm PATH=/pnpm/bin:/pnpm:$PATH
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM base AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=8080 HOSTNAME=0.0.0.0
# the insta CLI ships in the image so the app can fork a branch per learner
RUN pnpm add -g insta && adduser -D -u 1001 app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
USER app
EXPOSE 8080
CMD ["node", "server.js"]
