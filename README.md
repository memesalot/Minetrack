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
2. Configure via env vars or `config.json` (see [Configuration](#configuration) for the full list).
3. Configure servers with `SERVERS_JSON` / `SERVERS_FILE` or edit `servers.json`.
4. Run `npm ci` (native build will compile better-sqlite3).
5. Run `npm run build` (bundles `assets/` into `dist/`).
6. Run `node main.js` to boot the system.

(There's also ```install.sh``` and ```start.sh```, but they may not work for your OS.)

All config keys still default to `config.json` if the corresponding env var is not set. Database logging is controlled by `logToDatabase` and the `database` block. For SQLite, no extra setup beyond the native build is required; for MySQL, ensure your credentials are correct and the database exists.

If you enable `TRUST_PROXY`, also set `TRUSTED_PROXIES` to the IPs or CIDR ranges of the reverse proxies that are allowed to supply forwarded client IP headers. The default trusted list only covers loopback proxies (`127.0.0.1`, `::1`).

## Configuration
Minetrack reads its configuration from environment variables, falling back to `config.json` for any key that is not set. Every key in `config.json` has a matching environment variable.

**Precedence:** environment variable > `config.json` value. For servers: `SERVERS_JSON` (or its `SERVERS` alias) > `SERVERS_FILE` > `servers.json`.

**Value formats:**
- **Booleans** accept `1`, `true`, `yes`, `y`, `on` (case-insensitive); anything else is `false`.
- **Numbers** are parsed normally (e.g. `3000`); invalid or empty values fall back to the default.
- **Arrays** are comma-separated (e.g. `ALLOWED_ORIGINS=http://a,http://b`).
- **Strings** are passed through verbatim.

### Site & network
| Env var | config.json path | Default | Description |
| --- | --- | --- | --- |
| `SITE_IP` | `site.ip` | `0.0.0.0` | Address to bind |
| `SITE_PORT` | `site.port` | `8080` | Port to bind |

### Ping
| Env var | config.json path | Default | Description |
| --- | --- | --- | --- |
| `PING_ALL_INTERVAL` | `rates.pingAll` | `3000` | Ms between ping rounds (all servers) |
| `PING_CONNECT_TIMEOUT` | `rates.connectTimeout` | `2500` | Per-ping connect timeout (ms) |

### Old pings cleanup
| Env var | config.json path | Default | Description |
| --- | --- | --- | --- |
| `OLD_PINGS_CLEANUP` | `oldPingsCleanup.enabled` | `false` | Enable pruning of stale ping records |
| `OLD_PINGS_CLEANUP_INTERVAL` | `oldPingsCleanup.interval` | `3600000` | Cleanup interval (ms) |

### Logging
| Env var | config.json path | Default | Description |
| --- | --- | --- | --- |
| `LOG_FAILED_PINGS` | `logFailedPings` | `true` | Log ping failures |
| `LOG_TO_DATABASE` | `logToDatabase` | `false` | Persist player counts to the database |
| `CREATE_DAILY_DATABASE_COPY` | `createDailyDatabaseCopy` | `false` | Write a daily copy of the SQLite database |

### Database
| Env var | config.json path | Default | Description |
| --- | --- | --- | --- |
| `DB_TYPE` | `database.type` | `sqlite` | `sqlite` or `mysql` |
| `SQLITE_FILENAME` | `database.sqlite.filename` | `database.sql` | SQLite file path |
| `MYSQL_HOST` | `database.mysql.host` | `localhost` | MySQL host |
| `MYSQL_PORT` | `database.mysql.port` | `3306` | MySQL port |
| `MYSQL_USER` | `database.mysql.user` | `minetrack` | MySQL user |
| `MYSQL_PASSWORD` | `database.mysql.password` | _(empty)_ | MySQL password |
| `MYSQL_DATABASE` | `database.mysql.database` | `minetrack` | MySQL database name |
| `MYSQL_CONNECTION_LIMIT` | `database.mysql.connectionLimit` | `10` | MySQL pool size |

### Graphs
| Env var | config.json path | Default | Description |
| --- | --- | --- | --- |
| `GRAPH_DURATION` | `graphDuration` | `43200000` | Historical graph span (ms, 12h) |
| `GRAPH_DURATION_LABEL` | `graphDurationLabel` | _(auto)_ | Override the peak label text |
| `SERVER_GRAPH_DURATION` | `serverGraphDuration` | `180000` | Per-server graph span (ms, 3m) |

### Proxy & origins
| Env var | config.json path | Default | Description |
| --- | --- | --- | --- |
| `TRUST_PROXY` | `trustProxy` | `false` | Honor forwarded IP headers |
| `TRUSTED_PROXIES` | `trustedProxies` | `127.0.0.1, ::1` | IPs/CIDRs allowed to send forwarded headers |
| `ALLOWED_ORIGINS` | `allowedOrigins` | _(empty)_ | CORS-allowed origins |

### Connection limits
| Env var | config.json path | Default | Description |
| --- | --- | --- | --- |
| `CONNECTION_MAX_PER_IP` | `connectionLimits.maxPerIp` | `20` | Max concurrent connections per IP |
| `CONNECTION_MAX_TOTAL` | `connectionLimits.maxTotal` | `500` | Max concurrent connections total |

### WebSocket
| Env var | config.json path | Default | Description |
| --- | --- | --- | --- |
| `WS_MAX_MESSAGES` | `wsRateLimits.maxMessagesPerWindow` | `10` | Max WS messages per window per client |
| `WS_WINDOW_MS` | `wsRateLimits.windowMs` | `60000` | Rate-limit window (ms) |
| `WS_MAX_PAYLOAD` | `wsMaxPayload` | `1024` | Max WS frame size (bytes) |

### HTTP server
| Env var | config.json path | Default | Description |
| --- | --- | --- | --- |
| `HTTP_TIMEOUT` | `httpTimeout` | `30000` | Request timeout (ms) |
| `HTTP_HEADERS_TIMEOUT` | `httpHeadersTimeout` | `10000` | Headers timeout (ms) |
| `HTTP_KEEP_ALIVE_TIMEOUT` | `httpKeepAliveTimeout` | `5000` | Keep-alive timeout (ms) |

### Security
| Env var | config.json path | Default | Description |
| --- | --- | --- | --- |
| `CONTENT_SECURITY_POLICY` | `contentSecurityPolicy` | _(see config.json)_ | CSP header value |

### Servers
| Env var | Description |
| --- | --- |
| `SERVERS_JSON` / `SERVERS` | Inline JSON array of servers (highest precedence) |
| `SERVERS_FILE` | Path to a JSON file of servers |
| _(unset)_ | Falls back to `servers.json` |

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
