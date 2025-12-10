'use strict'

const fs = require('fs')
const path = require('path')

const defaults = require('./servers.json')

function parseServers (raw, sourceLabel) {
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      throw new Error('value must be a JSON array')
    }
    return parsed
  } catch (err) {
    throw new Error(`Failed to parse ${sourceLabel}: ${err.message}`)
  }
}

function loadFromFile (filePath) {
  const resolved = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath)
  const raw = fs.readFileSync(resolved, 'utf8')
  return parseServers(raw, `SERVERS_FILE (${resolved})`)
}

const envServers = process.env.SERVERS_JSON || process.env.SERVERS
if (envServers) {
  module.exports = parseServers(envServers, 'SERVERS_JSON / SERVERS')
} else if (process.env.SERVERS_FILE) {
  module.exports = loadFromFile(process.env.SERVERS_FILE)
} else {
  module.exports = defaults
}

