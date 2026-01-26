import { captureException, captureMessage } from "./sentry";

export type LogLevel = "debug" | "info" | "warn" | "error";

class Logger {
  private isDevelopment = process.env.NODE_ENV === "development";

  private log(level: LogLevel, message: string, ...args: any[]) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    if (this.isDevelopment) {
      // In development, use console
      switch (level) {
        case "debug":
          console.debug(prefix, message, ...args);
          break;
        case "info":
          console.info(prefix, message, ...args);
          break;
        case "warn":
          console.warn(prefix, message, ...args);
          break;
        case "error":
          console.error(prefix, message, ...args);
          break;
      }
    }

    // In production, send to Sentry for errors and warnings
    if (!this.isDevelopment) {
      if (level === "error") {
        const error = args[0] instanceof Error ? args[0] : new Error(message);
        captureException(error, { message, args: args.length > 0 ? args : undefined });
      } else if (level === "warn") {
        captureMessage(message, "warning");
      }
    }
  }

  debug(message: string, ...args: any[]) {
    this.log("debug", message, ...args);
  }

  info(message: string, ...args: any[]) {
    this.log("info", message, ...args);
  }

  warn(message: string, ...args: any[]) {
    this.log("warn", message, ...args);
  }

  error(message: string, error?: Error | any, ...args: any[]) {
    if (error instanceof Error) {
      this.log("error", message, error, ...args);
    } else {
      this.log("error", message, error, ...args);
    }
  }
}

export const logger = new Logger();
