const http = require('http')
const net = require('net')
const format = require('util').format

const WebSocket = require('ws')
const finalHttpHandler = require('finalhandler')
const serveStatic = require('serve-static')
const compression = require('compression')

const logger = require('./logger')
const config = require('../config')

const HASHED_FAVICON_URL_REGEX = /hashedfavicon_([a-z0-9]{32}).png/g

function getRemoteAddr (req) {
  const remoteAddr = normalizeIp(req.socket?.remoteAddress || req.connection?.remoteAddress)

  if (config.trustProxy && remoteAddr && isTrustedProxy(remoteAddr)) {
    const xff = parseForwardedFor(req.headers['x-forwarded-for'])
    if (xff.length > 0) {
      const chain = [...xff, remoteAddr]

      // Walk from the app back toward the client and stop at the first
      // hop that is not one of our trusted proxies.
      for (let i = chain.length - 2; i >= 0; i--) {
        if (!isTrustedProxy(chain[i])) {
          return chain[i]
        }
      }

      return xff[0]
    }

    const cfIp = normalizeIp(req.headers['cf-connecting-ip'])
    if (cfIp && !isTrustedProxy(cfIp)) {
      return cfIp
    }
  }

  return remoteAddr
}

function isValidIp (ip) {
  return !!normalizeIp(ip)
}

function normalizeIp (ip) {
  if (typeof ip !== 'string') {
    return
  }

  const trimmed = ip.trim().toLowerCase()
  if (!trimmed) {
    return
  }

  const zoneIndex = trimmed.indexOf('%')
  const normalized = zoneIndex >= 0 ? trimmed.substring(0, zoneIndex) : trimmed

  if (normalized.startsWith('::ffff:')) {
    const mappedIpv4 = normalized.substring(7)
    if (net.isIP(mappedIpv4) === 4) {
      return mappedIpv4
    }
  }

  return net.isIP(normalized) ? normalized : undefined
}

function parseForwardedFor (xff) {
  if (typeof xff !== 'string') {
    return []
  }

  return xff
    .split(',')
    .map(normalizeIp)
    .filter(Boolean)
}

function isTrustedProxy (ip) {
  const trustedProxies = config.trustedProxies || []
  return trustedProxies.some(range => ipMatchesRange(ip, range))
}

function ipMatchesRange (ip, range) {
  const normalizedIp = normalizeIp(ip)
  if (!normalizedIp || typeof range !== 'string' || !range.trim()) {
    return false
  }

  const trimmedRange = range.trim()
  if (!trimmedRange.includes('/')) {
    return normalizedIp === normalizeIp(trimmedRange)
  }

  const [base, prefixLengthRaw] = trimmedRange.split('/')
  const normalizedBase = normalizeIp(base)
  if (!normalizedBase) {
    return false
  }

  const ipFamily = net.isIP(normalizedIp)
  const baseFamily = net.isIP(normalizedBase)
  if (!ipFamily || ipFamily !== baseFamily) {
    return false
  }

  const totalBits = ipFamily === 4 ? 32 : 128
  const prefixLength = Number(prefixLengthRaw)
  if (!Number.isInteger(prefixLength) || prefixLength < 0 || prefixLength > totalBits) {
    return false
  }

  const ipValue = ipToBigInt(normalizedIp)
  const baseValue = ipToBigInt(normalizedBase)
  if (typeof ipValue === 'undefined' || typeof baseValue === 'undefined') {
    return false
  }

  if (prefixLength === 0) {
    return true
  }

  const shift = BigInt(totalBits - prefixLength)
  return (ipValue >> shift) === (baseValue >> shift)
}

function ipToBigInt (ip) {
  const family = net.isIP(ip)

  if (family === 4) {
    return ip.split('.').reduce((value, octet) => {
      return (value << 8n) + BigInt(parseInt(octet, 10))
    }, 0n)
  }

  if (family !== 6) {
    return
  }

  let workingIp = ip
  if (workingIp.includes('.')) {
    const lastColonIndex = workingIp.lastIndexOf(':')
    const ipv4 = workingIp.substring(lastColonIndex + 1)
    if (net.isIP(ipv4) !== 4) {
      return
    }

    const ipv4Parts = ipv4.split('.').map(part => parseInt(part, 10))
    const high = ((ipv4Parts[0] << 8) | ipv4Parts[1]).toString(16)
    const low = ((ipv4Parts[2] << 8) | ipv4Parts[3]).toString(16)
    workingIp = `${workingIp.substring(0, lastColonIndex)}:${high}:${low}`
  }

  const halves = workingIp.split('::')
  if (halves.length > 2) {
    return
  }

  const head = halves[0] ? halves[0].split(':').filter(Boolean) : []
  const tail = halves[1] ? halves[1].split(':').filter(Boolean) : []
  const missingGroups = 8 - (head.length + tail.length)

  if (missingGroups < 0 || (halves.length === 1 && missingGroups !== 0)) {
    return
  }

  const groups = [
    ...head,
    ...Array(missingGroups).fill('0'),
    ...tail
  ]

  if (groups.length !== 8) {
    return
  }

  return groups.reduce((value, group) => {
    return (value << 16n) + BigInt(parseInt(group || '0', 16))
  }, 0n)
}

function sanitizeUrl (url) {
  if (typeof url !== 'string') {
    return '[invalid]'
  }
  return url.substring(0, 200).replace(/[\r\n]/g, '')
}

function setSecurityHeaders (res) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')

  if (config.contentSecurityPolicy) {
    res.setHeader('Content-Security-Policy', config.contentSecurityPolicy)
  }
}

class Server {
  static getHashedFaviconUrl (hash) {
    // Format must be compatible with HASHED_FAVICON_URL_REGEX
    return format('/hashedfavicon_%s.png', hash)
  }

  constructor (app) {
    this._app = app
    this._connectionCounts = new Map()
    this._compress = compression()

    this.createHttpServer()
    this.createWebSocketServer()
  }

  createHttpServer () {
    const distServeStatic = serveStatic('dist/', {
      maxAge: '30d',
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache')
        } else {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
        }
      }
    })
    const faviconsServeStatic = serveStatic('favicons/', {
      maxAge: '7d'
    })

    this._http = http.createServer((req, res) => {
      this._compress(req, res, () => {
        setSecurityHeaders(res)

        logger.log('info', '%s requested: %s', getRemoteAddr(req), sanitizeUrl(req.url))

        // Test the URL against a regex for hashed favicon URLs
        // Require only 1 match ([0]) and test its first captured group ([1])
        // Any invalid value or hit miss will pass into static handlers below
        const faviconHash = [...req.url.matchAll(HASHED_FAVICON_URL_REGEX)]

        if (faviconHash.length === 1 && this.handleFaviconRequest(res, faviconHash[0][1])) {
          return
        }

        // Attempt to handle req using distServeStatic, otherwise fail over to faviconServeStatic
        // If faviconServeStatic fails, pass to finalHttpHandler to terminate
        distServeStatic(req, res, () => {
          faviconsServeStatic(req, res, finalHttpHandler(req, res))
        })
      })
    })

    this._http.timeout = config.httpTimeout || 30000
    this._http.headersTimeout = config.httpHeadersTimeout || 10000
    this._http.keepAliveTimeout = config.httpKeepAliveTimeout || 5000
  }

  handleFaviconRequest = (res, faviconHash) => {
    for (const serverRegistration of this._app.serverRegistrations) {
      if (serverRegistration.faviconHash && serverRegistration.faviconHash === faviconHash && serverRegistration.lastFaviconBuffer) {
        const buf = serverRegistration.lastFaviconBuffer

        res.writeHead(200, {
          'Content-Type': 'image/png',
          'Content-Length': buf.length,
          'Cache-Control': 'public, max-age=604800' // Cache hashed favicon for 7 days
        }).end(buf)

        return true
      }
    }

    return false
  }

  createWebSocketServer () {
    this._wss = new WebSocket.Server({
      server: this._http,
      maxPayload: config.wsMaxPayload || 1024
    })

    this._wss.on('connection', (client, req) => {
      const remoteAddr = getRemoteAddr(req)

      if (!this.isOriginAllowed(req)) {
        logger.log('warn', 'Blocked WebSocket connection from %s due to origin %s', remoteAddr, req.headers.origin)
        client.close(1008, 'Origin not allowed')
        return
      }

      if (!this.registerConnection(remoteAddr)) {
        logger.log('warn', 'Rejected WebSocket connection from %s: connection limits exceeded', remoteAddr)
        client.close(1013, 'Too many connections')
        return
      }

      logger.log('info', '%s connected, total clients: %d', remoteAddr, this.getConnectedClients())

      client._messageCount = 0
      client._messageResetTime = Date.now()

      // Bind disconnect event for logging
      client.on('close', () => {
        this.unregisterConnection(remoteAddr)
        logger.log('info', '%s disconnected, total clients: %d', remoteAddr, this.getConnectedClients())
      })

      // Pass client off to proxy handler
      this._app.handleClientConnection(client)
    })
  }

  listen (host, port) {
    this._http.listen(port, host)

    logger.log('info', 'Started on %s:%d', host, port)
  }

  broadcast (payload) {
    this._wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload)
      }
    })
  }

  getConnectedClients () {
    let count = 0
    this._wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        count++
      }
    })
    return count
  }

  isOriginAllowed (req) {
    const origin = req.headers.origin
    const allowedOrigins = config.allowedOrigins

    if (Array.isArray(allowedOrigins) && allowedOrigins.length > 0) {
      return !origin || allowedOrigins.includes(origin)
    }

    // Default allow list: match the requested host when an Origin header is present
    if (!origin) {
      return true
    }

    const host = req.headers.host
    if (!host) {
      return false
    }

    const expectedOrigins = [`http://${host}`, `https://${host}`]
    return expectedOrigins.includes(origin)
  }

  registerConnection (remoteAddr) {
    const limits = config.connectionLimits || {}
    const maxPerIp = limits.maxPerIp || 20
    const maxTotal = limits.maxTotal || 500

    const perIpCount = (this._connectionCounts.get(remoteAddr) || 0) + 1
    if (perIpCount > maxPerIp) {
      return false
    }

    if (this.getConnectedClients() >= maxTotal) {
      return false
    }

    this._connectionCounts.set(remoteAddr, perIpCount)
    return true
  }

  unregisterConnection (remoteAddr) {
    const current = this._connectionCounts.get(remoteAddr)
    if (typeof current === 'number') {
      if (current <= 1) {
        this._connectionCounts.delete(remoteAddr)
      } else {
        this._connectionCounts.set(remoteAddr, current - 1)
      }
    }
  }
}

module.exports = Server
