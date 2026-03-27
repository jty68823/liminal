import pino from 'pino';
import path from 'path';
import fs from 'fs';

const isDev = process.env['NODE_ENV'] !== 'production';

// Ensure log directory exists for file transport in production
const LOG_DIR = process.env['LOG_DIR'] ?? './data/logs';
if (!isDev) {
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
  } catch { /* best-effort */ }
}

const transports: pino.TransportMultiOptions['targets'] = [];

if (isDev) {
  transports.push({
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
    },
    level: 'debug',
  });
} else {
  // stdout for structured JSON logs
  transports.push({
    target: 'pino/file',
    options: { destination: 1 },
    level: 'info',
  });
  // File transport for persistent logs
  transports.push({
    target: 'pino/file',
    options: { destination: path.join(LOG_DIR, 'liminal.log'), mkdir: true },
    level: 'info',
  });
}

export const logger = pino({
  level: process.env['LOG_LEVEL'] ?? (isDev ? 'debug' : 'info'),
  transport: { targets: transports },
});

export function createChildLogger(module: string) {
  return logger.child({ module });
}

/** Create a logger bound to a specific request context */
export function createRequestLogger(module: string, requestId: string) {
  return logger.child({ module, requestId });
}
