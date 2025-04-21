const { createLogger, format, transports } = require('winston');
const chalk = require('chalk');
const util = require('util');
const { combine, timestamp, printf } = format;

// Custom color palette
const LOG_COLORS = {
  error: chalk.redBright,
  warn: chalk.yellowBright,
  info: chalk.cyanBright,
  debug: chalk.magentaBright,
  http: chalk.greenBright,
  alert: chalk.bgRed.whiteBright
};

// Custom format for console output
const consoleFormat = printf(({ level, message, timestamp, ...metadata }) => {
  const color = LOG_COLORS[level] || chalk.white;
  const symbol = {
    error: '⛔',
    warn: '⚠️',
    info: 'ℹ️',
    debug: '🐛',
    http: '🌐'
  }[level] || '➤';

  let logMessage = [
    `${chalk.gray(timestamp)}`,
    `${color(`${symbol} ${level.toUpperCase()}`)}:`,
    `${chalk.white(message)}`
  ].join(' ');

  if (metadata && Object.keys(metadata).length) {
    logMessage += `\n${chalk.gray('↳ ')}${util.inspect(metadata, { colors: true, depth: 3 })}`;
  }

  return logMessage;
});

// Central logger instance
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    consoleFormat
  ),
  transports: [
    new transports.Console(),
    // Add file transports as needed
  ],
  exceptionHandlers: [
    new transports.Console({
      format: consoleFormat
    })
  ],
  exitOnError: false
});

// Add convenience methods for common log levels
logger.error = (msg, metadata) => logger.log('error', msg, metadata);
logger.warn = (msg, metadata) => logger.log('warn', msg, metadata);
logger.info = (msg, metadata) => logger.log('info', msg, metadata);
logger.debug = (msg, metadata) => logger.log('debug', msg, metadata);
logger.http = (msg, metadata) => logger.log('http', msg, metadata);
logger.success = (msg, metadata) => logger.log('info', `✅ ${msg}`, metadata);

// Enhanced alerting system
const alertSystem = {
  critical: (message, metadata) => {
    logger.error(`🚨 CRITICAL: ${message}`, metadata);
    // Integrate with external alerting (Slack/PagerDuty)
  },

  security: (message, metadata) => {
    logger.error(`🛡️ SECURITY ALERT: ${message}`, metadata);
    // Trigger security protocols
  }
};

// API Response Logger Middleware
const responseLogger = (req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusColor = res.statusCode >= 400 ? chalk.red : chalk.green;

    logger.http(`${req.method} ${req.originalUrl}`, {
      status: statusColor(res.statusCode),
      duration: `${duration}ms`,
      ip: req.ip,
      user: req.user?.id || 'anonymous'
    });
  });

  next();
};

// Enhanced error handling
const errorLogger = (error, context = {}) => {
  logger.error(`💥 ${error.message}`, {
    stack: error.stack,
    ...context
  });

  if (error.isOperational) {
    alertSystem.critical(`Operational Error: ${error.message}`, context);
  }
};

// Custom inspection for deep object logging
const inspect = (obj, depth = 5) => {
  return util.inspect(obj, { colors: true, depth, breakLength: Infinity });
};

module.exports = {
  logger,
  alertSystem,
  responseLogger,
  errorLogger,
  inspect
};