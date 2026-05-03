import {
  logDebug,
  logError,
  logFatal,
  logInfo,
  logWarn,
} from "../../observability";

export const logger = {
  debug(message: string, meta?: unknown) {
    logDebug(message, meta);
  },
  error(message: string, meta?: unknown) {
    logError(message, meta);
  },
  fatal(message: string, meta?: unknown) {
    logFatal(message, meta);
  },
  info(message: string, meta?: unknown) {
    logInfo(message, meta);
  },
  warn(message: string, meta?: unknown) {
    logWarn(message, meta);
  },
};
