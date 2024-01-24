import {
  Logger,
  createLogger as createWinstonLogger,
  format,
  transports,
} from 'winston';
import { IS_DEV } from '@/common/const';

let logger: Logger | null = null;

export function createLogger(tag: string): Logger {
  if (logger !== null) {
    logger.close();
  }

  logger = createWinstonLogger({
    // basic info: level + message + timestamp
    format: format.combine(
      format((log) => {
        log.tag = tag;
        return log;
      })(),
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      format.json(),
    ),
  });

  if (IS_DEV) {
    logger.add(
      new transports.Console({
        level: 'info',
        format: format.combine(
          // set log.level to upper-case
          format((log) => {
            log.level = log.level.toUpperCase();
            return log;
          })(),
          // then append color unicode string to log.level
          format.colorize(),
          format.align(),
          format.printf(
            (log) =>
              `[${log.timestamp}][${log.level}][${log.tag}] ${log.message}`,
          ),
        ),
      }),
    );
  }

  return logger;
}

export function getLogger() {
  return logger;
}
