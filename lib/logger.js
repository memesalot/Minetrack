const winston = require('winston')

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.splat(),
    winston.format.timestamp({
      format: () => {
        const date = new Date()
        return date.toLocaleTimeString() + ' ' + date.toLocaleDateString()
      }
    }),
    winston.format.printf(({ level, message, timestamp }) => {
      return `${timestamp} [${level.toUpperCase()}] ${message}`
    })
  ),
  transports: [
    new winston.transports.File({ filename: 'minetrack.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.splat(),
        winston.format.colorize(),
        winston.format.timestamp({
          format: () => {
            const date = new Date()
            return date.toLocaleTimeString() + ' ' + date.toLocaleDateString()
          }
        }),
        winston.format.printf(({ level, message, timestamp }) => {
          return `${timestamp} [${level}] ${message}`
        })
      )
    })
  ]
})

module.exports = logger
