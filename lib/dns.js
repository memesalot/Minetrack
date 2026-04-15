const dns = require('dns')
const net = require('net')

const logger = require('./logger')

const { TimeTracker } = require('./time')

const config = require('../config')

const SKIP_SRV_TIMEOUT = config.skipSrvTimeout || 60 * 60 * 1000

class DNSResolver {
  constructor (ip, port) {
    this._ip = ip
    this._port = port
  }

  _skipSrv () {
    this._skipSrvUntil = TimeTracker.getEpochMillis() + SKIP_SRV_TIMEOUT
  }

  _isSkipSrv () {
    return this._skipSrvUntil && TimeTracker.getEpochMillis() <= this._skipSrvUntil
  }

  resolve (callback) {
    if (net.isIP(this._ip)) {
      callback(this._ip, this._port, config.rates.connectTimeout)
      return
    }

    if (this._isSkipSrv()) {
      callback(this._ip, this._port, config.rates.connectTimeout)

      return
    }

    const startTime = TimeTracker.getEpochMillis()

    let callbackFired = false

    const fireCallback = (ip, port) => {
      if (!callbackFired) {
        callbackFired = true

        // Send currentTime - startTime to provide remaining connectionTime allowance
        const remainingTime = config.rates.connectTimeout - (TimeTracker.getEpochMillis() - startTime)

        callback(ip || this._ip, port || this._port, remainingTime)
      }
    }

    const timeoutCallback = setTimeout(fireCallback, config.rates.connectTimeout)

    dns.resolveSrv('_minecraft._tcp.' + this._ip, (err, records) => {
      // Cancel the timeout handler if not already fired
      if (!callbackFired) {
        clearTimeout(timeoutCallback)
      }

      // Test if the error indicates a miss, or if the records returned are empty
      if ((err && (err.code === 'ENOTFOUND' || err.code === 'ENODATA')) || !records || records.length === 0) {
        // Compare config.skipSrvTimeout directly since SKIP_SRV_TIMEOUT has an or'd value
        // isSkipSrvTimeoutDisabled == whether the config has a valid skipSrvTimeout value set
        const isSkipSrvTimeoutDisabled = typeof config.skipSrvTimeout === 'number' && config.skipSrvTimeout === 0

        // Only activate _skipSrv if the skipSrvTimeout value is either NaN or > 0
        // 0 represents a disabled flag
        if (!this._isSkipSrv() && !isSkipSrvTimeoutDisabled) {
          this._skipSrv()

          logger.log('warn', 'No SRV records were resolved for %s. Minetrack will skip attempting to resolve %s SRV records for %d minutes.', this._ip, this._ip, SKIP_SRV_TIMEOUT / (60 * 1000))
        }

        fireCallback()
      } else {
        // Only fires if !err && records.length > 0
        this._resolveSafeSrvTarget(records[0], fireCallback)
      }
    })
  }

  _resolveSafeSrvTarget (record, callback) {
    const targetHost = typeof record?.name === 'string'
      ? record.name.trim().replace(/\.$/, '')
      : ''

    if (!targetHost) {
      callback()
      return
    }

    dns.lookup(targetHost, { all: true, verbatim: true }, (err, addresses) => {
      if (err || !Array.isArray(addresses) || addresses.length === 0) {
        logger.log('warn', 'Unable to validate SRV target %s for %s: %s', targetHost, this._ip, err ? err.message : 'No addresses returned')
        callback()
        return
      }

      if (addresses.some(addressInfo => isPrivateOrReservedIp(addressInfo.address))) {
        logger.log('warn', 'Ignoring SRV target %s for %s because it resolves to a private or reserved address.', targetHost, this._ip)
        callback()
        return
      }

      callback(targetHost, record.port)
    })
  }
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

function isPrivateOrReservedIp (ip) {
  const normalized = normalizeIp(ip)
  const family = net.isIP(normalized)

  if (family === 4) {
    const [a, b, c, d] = normalized.split('.').map(part => parseInt(part, 10))

    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0 && (c === 0 || c === 2)) ||
      (a === 192 && b === 88 && c === 99) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113) ||
      a >= 224 ||
      (a === 255 && b === 255 && c === 255 && d === 255)
    )
  }

  if (family === 6) {
    return (
      normalized === '::' ||
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe8') ||
      normalized.startsWith('fe9') ||
      normalized.startsWith('fea') ||
      normalized.startsWith('feb') ||
      normalized.startsWith('2001:db8:')
    )
  }

  return false
}

module.exports = DNSResolver
