'use strict'

const defaults = require('./config.json')

const trueValues = ['1', 'true', 'yes', 'y', 'on']

function toBool (name, fallback) {
  const raw = process.env[name]
  if (raw === undefined) return fallback
  return trueValues.includes(raw.trim().toLowerCase())
}

function toNumber (name, fallback) {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return fallback
  const value = Number(raw)
  return Number.isFinite(value) ? value : fallback
}

function toString (name, fallback) {
  return process.env[name] !== undefined ? process.env[name] : fallback
}

function toArray (name, fallback = []) {
  const raw = process.env[name]
  if (raw === undefined) {
    return Array.isArray(fallback) ? [...fallback] : []
  }
  return raw.split(',').map(part => part.trim()).filter(Boolean)
}

const config = {
  ...defaults,
  site: {
    ...defaults.site,
    ip: toString('SITE_IP', defaults.site?.ip || '0.0.0.0'),
    port: toNumber('SITE_PORT', defaults.site?.port || 8080)
  },
  rates: {
    ...defaults.rates,
    pingAll: toNumber('PING_ALL_INTERVAL', defaults.rates?.pingAll || 3000),
    connectTimeout: toNumber('PING_CONNECT_TIMEOUT', defaults.rates?.connectTimeout || 2500)
  },
  oldPingsCleanup: {
    ...defaults.oldPingsCleanup,
    enabled: toBool('OLD_PINGS_CLEANUP', defaults.oldPingsCleanup?.enabled ?? false),
    interval: toNumber('OLD_PINGS_CLEANUP_INTERVAL', defaults.oldPingsCleanup?.interval || 3600000)
  },
  logFailedPings: toBool('LOG_FAILED_PINGS', defaults.logFailedPings ?? true),
  logToDatabase: toBool('LOG_TO_DATABASE', defaults.logToDatabase ?? false),
  database: {
    ...defaults.database,
    type: toString('DB_TYPE', defaults.database?.type || 'sqlite').toLowerCase(),
    sqlite: {
      ...(defaults.database?.sqlite || {}),
      filename: toString('SQLITE_FILENAME', defaults.database?.sqlite?.filename || 'database.sql')
    },
    mysql: {
      ...(defaults.database?.mysql || {}),
      host: toString('MYSQL_HOST', defaults.database?.mysql?.host || 'localhost'),
      port: toNumber('MYSQL_PORT', defaults.database?.mysql?.port || 3306),
      user: toString('MYSQL_USER', defaults.database?.mysql?.user || 'minetrack'),
      password: toString('MYSQL_PASSWORD', defaults.database?.mysql?.password || ''),
      database: toString('MYSQL_DATABASE', defaults.database?.mysql?.database || 'minetrack'),
      connectionLimit: toNumber('MYSQL_CONNECTION_LIMIT', defaults.database?.mysql?.connectionLimit || 10)
    }
  },
  graphDuration: toNumber('GRAPH_DURATION', defaults.graphDuration || 43200000),
  graphDurationLabel: toString('GRAPH_DURATION_LABEL', defaults.graphDurationLabel),
  serverGraphDuration: toNumber('SERVER_GRAPH_DURATION', defaults.serverGraphDuration || 180000),
  trustProxy: toBool('TRUST_PROXY', defaults.trustProxy || false),
  allowedOrigins: toArray('ALLOWED_ORIGINS', defaults.allowedOrigins || []),
  connectionLimits: {
    ...(defaults.connectionLimits || {}),
    maxPerIp: toNumber('CONNECTION_MAX_PER_IP', defaults.connectionLimits?.maxPerIp || 20),
    maxTotal: toNumber('CONNECTION_MAX_TOTAL', defaults.connectionLimits?.maxTotal || 500)
  },
  wsRateLimits: {
    ...(defaults.wsRateLimits || {}),
    maxMessagesPerWindow: toNumber('WS_MAX_MESSAGES', defaults.wsRateLimits?.maxMessagesPerWindow || 10),
    windowMs: toNumber('WS_WINDOW_MS', defaults.wsRateLimits?.windowMs || 60000)
  },
  wsMaxPayload: toNumber('WS_MAX_PAYLOAD', defaults.wsMaxPayload || 1024),
  httpTimeout: toNumber('HTTP_TIMEOUT', defaults.httpTimeout || 30000),
  httpHeadersTimeout: toNumber('HTTP_HEADERS_TIMEOUT', defaults.httpHeadersTimeout || 10000),
  httpKeepAliveTimeout: toNumber('HTTP_KEEP_ALIVE_TIMEOUT', defaults.httpKeepAliveTimeout || 5000),
  contentSecurityPolicy: toString('CONTENT_SECURITY_POLICY', defaults.contentSecurityPolicy),
  createDailyDatabaseCopy: toBool('CREATE_DAILY_DATABASE_COPY', defaults.createDailyDatabaseCopy ?? false)
}

module.exports = config

