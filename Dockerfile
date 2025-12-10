FROM node:22-slim AS build

RUN apt-get update \
 && apt-get install --yes --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --include=dev --build-from-source

COPY . .
RUN npm run build \
 && npm prune --production

FROM node:22-slim

RUN apt-get update \
 && apt-get install --yes --no-install-recommends tini \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd -r -g 10043 minetrack \
 && useradd  -r -u 10042 -g minetrack -M -d /usr/src/minetrack -s /usr/sbin/nologin minetrack \
 && mkdir -p /usr/src/minetrack \
 && chown -R minetrack:minetrack /usr/src/minetrack

WORKDIR /usr/src/minetrack

COPY --from=build /app ./

USER minetrack

ENV NODE_ENV=production

EXPOSE 8080

ENTRYPOINT ["tini", "--", "node", "main.js"]
