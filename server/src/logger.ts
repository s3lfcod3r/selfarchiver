import { pino } from 'pino';
import { env } from './env.js';

export const logger = pino({
    level: env.logLevel,
    transport:
        process.env.NODE_ENV === 'production'
            ? undefined
            : {
                  target: 'pino/file',
                  options: { destination: 1 },
              },
});

export type Logger = typeof logger;
