FROM node:16

# install tini and sqlite3 from distro packages
RUN apt-get update                                                           \
 && apt-get install    --quiet --yes --no-install-recommends sqlite3 tini    \
 && apt-get clean      --quiet --yes                                         \
 && apt-get autoremove --quiet --yes                                         \
 && rm -rf /var/lib/apt/lists/*

# copy minetrack files
WORKDIR /usr/src/minetrack
COPY . .

# build minetrack
RUN npm install --build-from-source \
 && npm run build

# run as non root
RUN addgroup --gid 10043 --system minetrack \
 && adduser  --uid 10042 --system --ingroup minetrack --no-create-home --gecos "" minetrack \
 && chown -R minetrack:minetrack /usr/src/minetrack
USER minetrack

EXPOSE 8080

ENTRYPOINT ["/usr/bin/tini", "--", "node", "main.js"]
