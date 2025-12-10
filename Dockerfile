FROM node:20

RUN apt-get update                                                                                 \
 && apt-get install    --quiet --yes --no-install-recommends sqlite3 tini python3 build-essential  \
 && apt-get clean      --quiet --yes                                                               \
 && apt-get autoremove --quiet --yes                                                               \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/minetrack

COPY package*.json ./
RUN npm ci --include=dev --build-from-source

COPY . .
RUN npm run build \
 && npm prune --production

RUN addgroup --gid 10043 --system minetrack \
 && adduser  --uid 10042 --system --ingroup minetrack --no-create-home --gecos "" minetrack \
 && chown -R minetrack:minetrack /usr/src/minetrack
USER minetrack

ENV NODE_ENV=production

EXPOSE 8080

ENTRYPOINT ["/usr/bin/tini", "--", "node", "main.js"]
