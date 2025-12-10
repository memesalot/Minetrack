<p align="center">
	<img width="120" height="120" src="assets/images/logo.svg">
</p>

# Minetrack
Minetrack makes it easy to keep an eye on your favorite Minecraft servers. Simple and hackable, Minetrack easily runs on any hardware. Use it for monitoring, analytics, or just for fun. This fork lives at [github.com/memesalot/Minetrack](https://github.com/memesalot/Minetrack) and builds on the original work by [Nick Krecklow / Cryptkeeper](https://github.com/Cryptkeeper/Minetrack).

### This project is not actively supported!
This project is not actively supported. Pull requests will be reviewed and merged (if accepted), but issues _might_ not be addressed outside of fixes provided by community members. Please share any improvements or fixes you've made so everyone can benefit from them.

### Features
- 🚀 Real time Minecraft server player count tracking with customizable update speed.
- 📝 Historical player count logging with 24 hour peak and player count record tracking.
- 📈 Historical graph with customizable time frame.
- 📦 Out of the box included dashboard with various customizable sorting and viewing options.
- 📱(Decent) mobile support.
- 🕹 Supports both Minecraft Java Edition and Minecraft Bedrock Edition.

### Community Showcase
You can find a list of community hosted instances below. Want to be listed here? Add yourself in a pull request!

* https://minetrack.me
* https://bedrock.minetrack.me
* https://minetrack.gg
* https://suomimine.fi
* https://minetrack.geyserconnect.net
* https://minetrack.fi
* https://www.anarchytrack.live/
* https://track.axsoter.com
* https://pvp-factions.fr
* https://stats.liste-serveurs.fr
* https://minetrack.galaxite.dev
* https://livemc.org
* https://track.pacor.ro
* https://minetrack.spielelp.de
* https://tracking.v4guard.io

## Updates
For updates and release notes, please read the [CHANGELOG](docs/CHANGELOG.md).

**Migrating to Minetrack 5?** See the [migration guide](docs/MIGRATING.md).

## Installation
1. Node 14+ is required (we use better-sqlite3, which ships native bindings).
2. Configure via env vars or `config.json`:
   - `DB_TYPE` (`sqlite`/`mysql`), `SQLITE_FILENAME`, `MYSQL_{HOST,PORT,USER,PASSWORD,DATABASE,CONNECTION_LIMIT}`
   - `LOG_TO_DATABASE`, `TRUST_PROXY`, `ALLOWED_ORIGINS`, `SITE_PORT`, `SITE_IP`
   - `CONNECTION_MAX_PER_IP`, `CONNECTION_MAX_TOTAL`, `WS_MAX_MESSAGES`, `WS_WINDOW_MS`, `WS_MAX_PAYLOAD`
3. Configure servers with `SERVERS_JSON` / `SERVERS_FILE` or edit `servers.json`.
4. Run `npm ci` (native build will compile better-sqlite3).
5. Run `npm run build` (bundles `assets/` into `dist/`).
6. Run `node main.js` to boot the system.

(There's also ```install.sh``` and ```start.sh```, but they may not work for your OS.)

All config keys still default to `config.json` if the corresponding env var is not set. Database logging is controlled by `logToDatabase` and the `database` block. For SQLite, no extra setup beyond the native build is required; for MySQL, ensure your credentials are correct and the database exists.

## Docker
Minetrack can be built and run with Docker from this repository in several ways:

### Build and deploy directly with Docker
```
# build image with name minetrack and tag latest
docker build . --tag minetrack:latest

# start container, delete on exit
# publish container port 8080 on host port 80
docker run --rm --publish 80:8080 minetrack:latest
```

The published port can be changed by modifying the parameter argument, e.g.:  
* Publish to host port 8080: `--publish 8080:8080`  
* Publish to localhost (thus prohibiting external access): `--publish 127.0.0.1:8080:8080`

### Build and deploy with docker compose
```
# build (image name comes from docker-compose.yml)
docker compose build

# start service
docker compose up -d

# stop service and remove artifacts
docker compose down
```

Example `docker-compose.yml` snippet with env-driven config:
```
services:
  minetrack:
    image: verycooldocker/minetrack:latest
    build: .
    environment:
      SITE_PORT: 8080
      LOG_TO_DATABASE: "false"
      DB_TYPE: sqlite
      SQLITE_FILENAME: /data/database.sql
      ALLOWED_ORIGINS: http://localhost:8080
      SERVERS_JSON: '[{"name":"Hypixel","ip":"mc.hypixel.net","type":"PC"}]'
    ports:
      - "8080:8080"
    volumes:
      - minetrack_data:/data
    restart: unless-stopped
volumes:
  minetrack_data:
```

### Publish to Docker Hub
1. Image is set to `verycooldocker/minetrack:latest` in `docker-compose.yml`. Change the tag if you want a versioned release.
2. Build: `docker compose build` (or `docker build -t verycooldocker/minetrack:latest .`).
3. Push: `docker compose push` (or `docker push verycooldocker/minetrack:latest`).

## Nginx reverse proxy
The following configuration enables Nginx to act as reverse proxy for a Minetrack instance that is available at port 8080 on localhost:
```
server {
    server_name minetrack.example.net;
    listen 80;
    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
    }
}
```
