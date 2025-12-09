const App = require('./lib/app')
const ServerRegistration = require('./lib/servers')

const logger = require('./lib/logger')

const config = require('./config')
const servers = require('./servers')

process.on('uncaughtException', (err) => {
  logger.log('error', 'Uncaught exception: %s', err.stack || err.message || err)
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  logger.log('error', 'Unhandled rejection: %s', reason)
})

function validateServer (server, index) {
  if (!server.name || typeof server.name !== 'string') {
    throw new Error(`Server at index ${index} missing valid "name"`)
  }
  if (!server.ip || typeof server.ip !== 'string') {
    throw new Error(`Server "${server.name}" missing valid "ip"`)
  }
  if (!['PC', 'PE'].includes(server.type)) {
    throw new Error(`Server "${server.name}" has invalid "type" (must be PC or PE)`)
  }
}

const app = new App()

servers.forEach((server, serverId) => {
  validateServer(server, serverId)
  // Assign a generated color for each servers.json entry if not manually defined
  // These will be passed to the frontend for use in rendering
  if (!server.color) {
    let hash = 0
    for (let i = server.name.length - 1; i >= 0; i--) {
      hash = server.name.charCodeAt(i) + ((hash << 5) - hash)
    }

    const color = Math.floor(Math.abs((Math.sin(hash) * 10000) % 1 * 16777216)).toString(16)
    server.color = '#' + Array(6 - color.length + 1).join('0') + color
  }

  // Init a ServerRegistration instance of each entry in servers.json
  app.serverRegistrations.push(new ServerRegistration(app, serverId, server))
})

if (!config.serverGraphDuration) {
  logger.log('warn', '"serverGraphDuration" is not defined in config.json - defaulting to 3 minutes!')
  config.serverGraphDuration = 3 * 60 * 10000
}

function shutdown () {
  logger.log('info', 'Shutting down...')

  if (app.database) {
    app.database.close()
  }

  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

if (!config.logToDatabase) {
  logger.log('warn', 'Database logging is not enabled. You can enable it by setting "logToDatabase" to true in config.json. This requires sqlite3 to be installed.')

  app.handleReady()
} else {
  app.loadDatabase(() => {
    app.handleReady()
  })
}
