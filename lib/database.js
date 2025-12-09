const logger = require('./logger')
const config = require('../config')
const { TimeTracker } = require('./time')

class SQLiteDatabase {
  constructor () {
    const Database = require('better-sqlite3')
    this._sql = new Database(config.database?.sqlite?.filename || 'database.sql')
    this._sql.pragma('journal_mode = WAL')
  }

  ensureIndexes (callback) {
    try {
      this._sql.exec('CREATE TABLE IF NOT EXISTS pings (timestamp BIGINT NOT NULL, ip TEXT, playerCount INTEGER)')
      this._sql.exec('CREATE TABLE IF NOT EXISTS players_record (timestamp BIGINT, ip TEXT NOT NULL PRIMARY KEY, playerCount INTEGER)')
      this._sql.exec('CREATE INDEX IF NOT EXISTS ip_index ON pings (ip, playerCount)')
      this._sql.exec('CREATE INDEX IF NOT EXISTS timestamp_index ON pings (timestamp)')
      setImmediate(callback)
    } catch (err) {
      logger.log('error', 'Cannot create table or table index: %s', err.message)
      throw err
    }
  }

  getRecentPings (startTime, endTime, callback) {
    try {
      const stmt = this._sql.prepare('SELECT timestamp, ip, playerCount FROM pings WHERE timestamp >= ? AND timestamp <= ?')
      const data = stmt.all(startTime, endTime)
      setImmediate(() => callback(data))
    } catch (err) {
      logger.log('error', 'Cannot get recent pings: %s', err.message)
      throw err
    }
  }

  getRecord (ip, callback) {
    try {
      const stmt = this._sql.prepare('SELECT playerCount, timestamp FROM players_record WHERE ip = ?')
      const row = stmt.get(ip)
      if (!row) {
        setImmediate(() => callback(false))
        return
      }
      setImmediate(() => callback(true, row.playerCount, row.timestamp))
    } catch (err) {
      logger.log('error', 'Cannot get ping record for %s: %s', ip, err.message)
      throw err
    }
  }

  getRecordLegacy (ip, callback) {
    try {
      const stmt = this._sql.prepare('SELECT MAX(playerCount) as maxCount, timestamp FROM pings WHERE ip = ?')
      const row = stmt.get(ip)
      if (!row || row.maxCount === null) {
        setImmediate(() => callback(false))
        return
      }
      setImmediate(() => callback(true, row.maxCount, row.timestamp))
    } catch (err) {
      logger.log('error', 'Cannot get legacy ping record for %s: %s', ip, err.message)
      throw err
    }
  }

  insertPing (ip, timestamp, playerCount, callback) {
    try {
      const stmt = this._sql.prepare('INSERT INTO pings (timestamp, ip, playerCount) VALUES (?, ?, ?)')
      stmt.run(timestamp, ip, playerCount)
      if (callback) setImmediate(callback)
    } catch (err) {
      logger.error('Cannot insert ping record of %s at %s: %s', ip, timestamp, err.message)
      throw err
    }
  }

  insertRecord (ip, timestamp, playerCount, callback) {
    try {
      const stmt = this._sql.prepare('INSERT INTO players_record (timestamp, ip, playerCount) VALUES (?, ?, ?)')
      stmt.run(timestamp, ip, playerCount)
      if (callback) setImmediate(callback)
    } catch (err) {
      logger.error('Cannot insert initial player count record of %s: %s', ip, err.message)
      throw err
    }
  }

  updateRecord (ip, playerCount, timestamp, callback) {
    try {
      const stmt = this._sql.prepare('UPDATE players_record SET timestamp = ?, playerCount = ? WHERE ip = ?')
      stmt.run(timestamp, playerCount, ip)
      if (callback) setImmediate(callback)
    } catch (err) {
      logger.error('Cannot update player count record of %s at %s: %s', ip, timestamp, err.message)
      throw err
    }
  }

  deleteOldPings (oldestTimestamp, callback) {
    try {
      const stmt = this._sql.prepare('DELETE FROM pings WHERE timestamp < ?')
      stmt.run(oldestTimestamp)
      if (callback) setImmediate(callback)
    } catch (err) {
      logger.error('Cannot delete old pings: %s', err.message)
      throw err
    }
  }

  close () {
    if (this._sql) {
      this._sql.close()
    }
  }
}

class MySQLDatabase {
  constructor () {
    const mysql = require('mysql2')
    const dbConfig = config.database?.mysql || {}

    this._pool = mysql.createPool({
      host: dbConfig.host || 'localhost',
      port: dbConfig.port || 3306,
      user: dbConfig.user || 'root',
      password: dbConfig.password || '',
      database: dbConfig.database || 'minetrack',
      waitForConnections: true,
      connectionLimit: dbConfig.connectionLimit || 10,
      queueLimit: 0
    })

    logger.log('info', 'MySQL connection pool created')
  }

  ensureIndexes (callback) {
    const queries = [
      'CREATE TABLE IF NOT EXISTS pings (id INT AUTO_INCREMENT PRIMARY KEY, timestamp BIGINT NOT NULL, ip VARCHAR(255), playerCount MEDIUMINT, INDEX idx_timestamp (timestamp), INDEX idx_ip_playercount (ip, playerCount))',
      'CREATE TABLE IF NOT EXISTS players_record (ip VARCHAR(255) NOT NULL PRIMARY KEY, timestamp BIGINT, playerCount MEDIUMINT)'
    ]

    let completed = 0
    const total = queries.length

    queries.forEach(query => {
      this._pool.query(query, err => {
        if (err) {
          logger.log('error', 'Cannot create table: %s', err.message)
          throw err
        }
        if (++completed === total) {
          callback()
        }
      })
    })
  }

  getRecentPings (startTime, endTime, callback) {
    this._pool.query(
      'SELECT timestamp, ip, playerCount FROM pings WHERE timestamp >= ? AND timestamp <= ?',
      [startTime, endTime],
      (err, data) => {
        if (err) {
          logger.log('error', 'Cannot get recent pings')
          throw err
        }
        callback(data)
      }
    )
  }

  getRecord (ip, callback) {
    this._pool.query(
      'SELECT playerCount, timestamp FROM players_record WHERE ip = ?',
      [ip],
      (err, data) => {
        if (err) {
          logger.log('error', `Cannot get ping record for ${ip}`)
          throw err
        }
        if (!data || data.length === 0) {
          callback(false)
          return
        }
        callback(true, data[0].playerCount, data[0].timestamp)
      }
    )
  }

  getRecordLegacy (ip, callback) {
    this._pool.query(
      'SELECT MAX(playerCount) as maxCount, timestamp FROM pings WHERE ip = ? GROUP BY ip',
      [ip],
      (err, data) => {
        if (err) {
          logger.log('error', `Cannot get legacy ping record for ${ip}`)
          throw err
        }
        if (!data || data.length === 0 || data[0].maxCount === null) {
          callback(false)
          return
        }
        callback(true, data[0].maxCount, data[0].timestamp)
      }
    )
  }

  insertPing (ip, timestamp, playerCount, callback) {
    this._pool.query(
      'INSERT INTO pings (timestamp, ip, playerCount) VALUES (?, ?, ?)',
      [timestamp, ip, playerCount],
      err => {
        if (err) {
          logger.error(`Cannot insert ping record of ${ip} at ${timestamp}`)
          throw err
        }
        if (callback) callback()
      }
    )
  }

  insertRecord (ip, timestamp, playerCount, callback) {
    this._pool.query(
      'INSERT INTO players_record (ip, timestamp, playerCount) VALUES (?, ?, ?)',
      [ip, timestamp, playerCount],
      err => {
        if (err) {
          logger.error(`Cannot insert initial player count record of ${ip}`)
          throw err
        }
        if (callback) callback()
      }
    )
  }

  updateRecord (ip, playerCount, timestamp, callback) {
    this._pool.query(
      'UPDATE players_record SET timestamp = ?, playerCount = ? WHERE ip = ?',
      [timestamp, playerCount, ip],
      err => {
        if (err) {
          logger.error(`Cannot update player count record of ${ip} at ${timestamp}`)
          throw err
        }
        if (callback) callback()
      }
    )
  }

  deleteOldPings (oldestTimestamp, callback) {
    this._pool.query(
      'DELETE FROM pings WHERE timestamp < ?',
      [oldestTimestamp],
      err => {
        if (err) {
          logger.error('Cannot delete old pings')
          throw err
        }
        if (callback) callback()
      }
    )
  }

  close () {
    if (this._pool) {
      this._pool.end()
    }
  }
}

class Database {
  constructor (app) {
    this._app = app

    const dbType = config.database?.type || 'sqlite'

    if (dbType === 'mysql') {
      this._db = new MySQLDatabase()
      this._isSQLite = false
    } else {
      this._db = new SQLiteDatabase()
      this._isSQLite = true
    }

    if (this._isSQLite) {
      this._initDailyCopy()
    }
  }

  _initDailyCopy () {
    if (!config.createDailyDatabaseCopy) {
      return
    }
    this._dailyCopyDb = null
    this._dailyCopyFileName = null
  }

  _getDailyDatabase () {
    if (!config.createDailyDatabaseCopy || !this._isSQLite) {
      return null
    }

    const Database = require('better-sqlite3')
    const date = new Date()
    const fileName = `database_copy_${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}.sql`

    if (fileName !== this._dailyCopyFileName) {
      if (this._dailyCopyDb) {
        this._dailyCopyDb.close()
      }

      this._dailyCopyDb = new Database(fileName)
      this._dailyCopyFileName = fileName

      try {
        this._dailyCopyDb.exec('CREATE TABLE IF NOT EXISTS pings (timestamp BIGINT NOT NULL, ip TEXT, playerCount INTEGER)')
      } catch (err) {
        logger.log('error', 'Cannot create initial table for daily database: %s', err.message)
        throw err
      }
    }

    return this._dailyCopyDb
  }

  ensureIndexes (callback) {
    this._db.ensureIndexes(callback)
  }

  loadGraphPoints (graphDuration, callback) {
    const endTime = TimeTracker.getEpochMillis()
    const startTime = endTime - graphDuration

    this._db.getRecentPings(startTime, endTime, pingData => {
      const relativeGraphData = []

      for (const row of pingData) {
        let graphData = relativeGraphData[row.ip]
        if (!graphData) {
          relativeGraphData[row.ip] = graphData = [[], []]
        }
        graphData[0].push(row.timestamp)
        graphData[1].push(row.playerCount)
      }

      Object.keys(relativeGraphData).forEach(ip => {
        for (const serverRegistration of this._app.serverRegistrations) {
          if (serverRegistration.data.ip === ip) {
            const graphData = relativeGraphData[ip]
            serverRegistration.loadGraphPoints(startTime, graphData[0], graphData[1])
            break
          }
        }
      })

      if (Object.keys(relativeGraphData).length > 0) {
        const serverIp = Object.keys(relativeGraphData)[0]
        const timestamps = relativeGraphData[serverIp][0]
        this._app.timeTracker.loadGraphPoints(startTime, timestamps)
      }

      callback()
    })
  }

  loadRecords (callback) {
    let completedTasks = 0
    const totalTasks = this._app.serverRegistrations.length

    if (totalTasks === 0) {
      callback()
      return
    }

    this._app.serverRegistrations.forEach(serverRegistration => {
      serverRegistration.findNewGraphPeak()

      this._db.getRecord(serverRegistration.data.ip, (hasRecord, playerCount, timestamp) => {
        if (hasRecord) {
          serverRegistration.recordData = {
            playerCount,
            timestamp: TimeTracker.toSeconds(timestamp)
          }
          if (++completedTasks === totalTasks) {
            callback()
          }
        } else {
          this._db.getRecordLegacy(serverRegistration.data.ip, (hasRecordLegacy, playerCountLegacy, timestampLegacy) => {
            let newTimestamp = null
            let newPlayerCount = null

            if (hasRecordLegacy) {
              newTimestamp = timestampLegacy
              newPlayerCount = playerCountLegacy
            }

            serverRegistration.recordData = {
              playerCount: newPlayerCount,
              timestamp: TimeTracker.toSeconds(newTimestamp)
            }

            this._db.insertRecord(serverRegistration.data.ip, newTimestamp, newPlayerCount, () => {
              if (++completedTasks === totalTasks) {
                callback()
              }
            })
          })
        }
      })
    })
  }

  insertPing (ip, timestamp, unsafePlayerCount) {
    this._db.insertPing(ip, timestamp, unsafePlayerCount)

    const dailyDb = this._getDailyDatabase()
    if (dailyDb) {
      try {
        const stmt = dailyDb.prepare('INSERT INTO pings (timestamp, ip, playerCount) VALUES (?, ?, ?)')
        stmt.run(timestamp, ip, unsafePlayerCount)
      } catch (err) {
        logger.error('Cannot insert into daily database: %s', err.message)
      }
    }
  }

  updatePlayerCountRecord (ip, playerCount, timestamp) {
    this._db.updateRecord(ip, playerCount, timestamp)
  }

  initOldPingsDelete (callback) {
    logger.info('Deleting old pings..')
    this.deleteOldPings(() => {
      const oldPingsCleanupInterval = config.oldPingsCleanup.interval || 3600000
      if (oldPingsCleanupInterval > 0) {
        setInterval(() => this.deleteOldPings(), oldPingsCleanupInterval)
      }
      callback()
    })
  }

  deleteOldPings (callback) {
    const oldestTimestamp = TimeTracker.getEpochMillis() - config.graphDuration
    const deleteStart = TimeTracker.getEpochMillis()

    this._db.deleteOldPings(oldestTimestamp, () => {
      const deleteTook = TimeTracker.getEpochMillis() - deleteStart
      logger.info(`Old pings deleted in ${deleteTook}ms`)
      if (callback) {
        callback()
      }
    })
  }

  close () {
    this._db.close()
    if (this._dailyCopyDb) {
      this._dailyCopyDb.close()
    }
  }
}

module.exports = Database
