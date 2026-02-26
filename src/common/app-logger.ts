import { writeSync } from 'fs';

/**
 * Structured JSON logger for application events (RAG, vector store, ingest).
 * No API keys or third-party services. Logs to stdout for:
 * - docker compose logs
 * - grep / jq in shell
 * - Optional self-hosted collectors (e.g. Loki, Grafana) later
 * Uses sync write so each line flushes immediately (visible in docker compose logs -f).
 */
export type LogLevel = 'log' | 'warn' | 'debug' | 'error';

export interface AppLogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  [key: string]: unknown;
}

export class AppLogger {
  // Pretty logs: when NODE_ENV is not production, or LOG_PRETTY=1 (e.g. in Docker)
  private static readonly pretty =
    process.env.NODE_ENV !== 'production' || process.env.LOG_PRETTY === '1';

  constructor(private readonly context: string) {}

  private write(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    const entry: AppLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      context: this.context,
      message,
      ...data,
    };

    const fd = level === 'error' || level === 'warn' ? 2 : 1;

    if (AppLogger.pretty) {
      // Human-readable one-liner (dev or LOG_PRETTY=1 in Docker)
      const extras =
        data && Object.keys(data).length > 0
          ? ' ' + Object.entries(data).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ')
          : '';
      const line = `[${entry.timestamp}] [${this.context}] ${level.toUpperCase()} ${message}${extras}\n`;
      writeSync(fd, line);
    } else {
      // Production / Docker: single JSON line for grep, jq, log pipelines
      const line = JSON.stringify(entry) + '\n';
      writeSync(fd, line);
    }
  }

  log(message: string, data?: Record<string, unknown>): void {
    this.write('log', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.write('warn', message, data);
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.write('debug', message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.write('error', message, data);
  }
}
