import { captureException, captureMessage } from "./sentry";

export type LogLevel = "debug" | "info" | "warn" | "error";

class Logger {
  private isDevelopment = process.env.NODE_ENV === "development";
  private isProduction = process.env.NODE_ENV === "production";

  /**
   * Format log entry for production (JSON) or development (readable)
   */
  private formatLog(level: LogLevel, message: string, ...args: any[]): string | object {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...(args.length > 0 && { data: args }),
      environment: process.env.NODE_ENV || "development",
      service: "dansarp-herbal-centre",
    };

    if (this.isProduction) {
      // Return JSON for structured logging in production
      return JSON.stringify(logEntry);
    }

    // Return readable format for development
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  }

  private log(level: LogLevel, message: string, ...args: any[]) {
    const formatted = this.formatLog(level, message, ...args);

    if (this.isDevelopment) {
      // In development, use console with readable format
      switch (level) {
        case "debug":
          console.debug(formatted, ...args);
          break;
        case "info":
          console.info(formatted, ...args);
          break;
        case "warn":
          console.warn(formatted, ...args);
          break;
        case "error":
          console.error(formatted, ...args);
          break;
      }
    } else {
      // In production, use structured logging (already JSON stringified)
      console.log(formatted);
    }

    // Send to Sentry for errors and warnings in production
    if (this.isProduction) {
      if (level === "error") {
        const error = args[0] instanceof Error ? args[0] : new Error(message);
        const context = {
          message,
          ...(args.length > 0 && { additionalData: args }),
        };
        captureException(error, context);
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
