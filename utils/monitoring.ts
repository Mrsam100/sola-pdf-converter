/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Production monitoring and logging utilities
 */

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    CRITICAL = 4
}

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    context?: Record<string, any>;
    error?: Error;
    userId?: string;
    sessionId?: string;
}

class Logger {
    private logs: LogEntry[] = [];
    private maxLogs: number = 1000;
    private sessionId: string;
    private minLevel: LogLevel = LogLevel.INFO;

    constructor() {
        this.sessionId = this.generateSessionId();

        // Set log level based on environment
        if (process.env.NODE_ENV === 'development') {
            this.minLevel = LogLevel.DEBUG;
        }
    }

    private generateSessionId(): string {
        return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }

    private createLogEntry(
        level: LogLevel,
        message: string,
        context?: Record<string, any>,
        error?: Error
    ): LogEntry {
        return {
            timestamp: new Date().toISOString(),
            level,
            message,
            context,
            error,
            sessionId: this.sessionId
        };
    }

    private addLog(entry: LogEntry) {
        if (entry.level < this.minLevel) return;

        this.logs.push(entry);

        // Keep only last N logs
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }

        // Console output
        const levelName = LogLevel[entry.level];
        const contextStr = entry.context ? ` | ${JSON.stringify(entry.context)}` : '';
        const errorStr = entry.error ? ` | ${entry.error.message}\n${entry.error.stack}` : '';

        const logMessage = `[${entry.timestamp}] [${levelName}] ${entry.message}${contextStr}${errorStr}`;

        switch (entry.level) {
            case LogLevel.DEBUG:
                console.debug(logMessage);
                break;
            case LogLevel.INFO:
                console.log(logMessage);
                break;
            case LogLevel.WARN:
                console.warn(logMessage);
                break;
            case LogLevel.ERROR:
            case LogLevel.CRITICAL:
                console.error(logMessage);
                break;
        }
    }

    debug(message: string, context?: Record<string, any>) {
        this.addLog(this.createLogEntry(LogLevel.DEBUG, message, context));
    }

    info(message: string, context?: Record<string, any>) {
        this.addLog(this.createLogEntry(LogLevel.INFO, message, context));
    }

    warn(message: string, context?: Record<string, any>) {
        this.addLog(this.createLogEntry(LogLevel.WARN, message, context));
    }

    error(message: string, error?: Error, context?: Record<string, any>) {
        this.addLog(this.createLogEntry(LogLevel.ERROR, message, context, error));
    }

    critical(message: string, error?: Error, context?: Record<string, any>) {
        this.addLog(this.createLogEntry(LogLevel.CRITICAL, message, context, error));
    }

    getLogs(): LogEntry[] {
        return [...this.logs];
    }

    clearLogs() {
        this.logs = [];
    }

    exportLogs(): string {
        return JSON.stringify(this.logs, null, 2);
    }
}

// Singleton logger instance
export const logger = new Logger();

/**
 * Performance monitoring
 */
class PerformanceMonitor {
    private metrics: Map<string, number[]> = new Map();

    startTimer(operation: string): () => void {
        const startTime = performance.now();

        return () => {
            const duration = performance.now() - startTime;
            this.recordMetric(operation, duration);
        };
    }

    recordMetric(operation: string, duration: number) {
        if (!this.metrics.has(operation)) {
            this.metrics.set(operation, []);
        }

        const metrics = this.metrics.get(operation)!;
        metrics.push(duration);

        // Keep only last 100 measurements
        if (metrics.length > 100) {
            metrics.shift();
        }

        logger.debug(`Performance: ${operation}`, {
            duration: `${duration.toFixed(2)}ms`,
            avg: `${this.getAverage(operation).toFixed(2)}ms`
        });
    }

    getAverage(operation: string): number {
        const metrics = this.metrics.get(operation);
        if (!metrics || metrics.length === 0) return 0;

        const sum = metrics.reduce((a, b) => a + b, 0);
        return sum / metrics.length;
    }

    getMetrics(operation: string) {
        const metrics = this.metrics.get(operation) || [];
        if (metrics.length === 0) {
            return { count: 0, avg: 0, min: 0, max: 0 };
        }

        return {
            count: metrics.length,
            avg: this.getAverage(operation),
            min: Math.min(...metrics),
            max: Math.max(...metrics)
        };
    }

    getAllMetrics() {
        const result: Record<string, any> = {};
        for (const [operation, _] of this.metrics) {
            result[operation] = this.getMetrics(operation);
        }
        return result;
    }

    clear() {
        this.metrics.clear();
    }
}

export const performanceMonitor = new PerformanceMonitor();

/**
 * Error tracking
 */
class ErrorTracker {
    private errors: Array<{
        error: Error;
        context: Record<string, any>;
        timestamp: Date;
        count: number;
    }> = [];

    private errorCounts: Map<string, number> = new Map();

    trackError(error: Error, context: Record<string, any> = {}) {
        const errorKey = `${error.name}:${error.message}`;

        // Increment error count
        const count = (this.errorCounts.get(errorKey) || 0) + 1;
        this.errorCounts.set(errorKey, count);

        // Add to error list
        this.errors.push({
            error,
            context,
            timestamp: new Date(),
            count
        });

        // Keep only last 100 errors
        if (this.errors.length > 100) {
            this.errors.shift();
        }

        // Log error
        logger.error(`Error tracked: ${error.message}`, error, {
            ...context,
            occurrences: count
        });

        // Alert on repeated errors
        if (count > 5) {
            logger.critical(`Repeated error (${count}x): ${error.message}`, error, context);
        }
    }

    getErrors() {
        return [...this.errors];
    }

    getErrorStats() {
        return Array.from(this.errorCounts.entries()).map(([key, count]) => ({
            error: key,
            count
        }));
    }

    clear() {
        this.errors = [];
        this.errorCounts.clear();
    }
}

export const errorTracker = new ErrorTracker();

/**
 * Global error handler
 */
export const setupGlobalErrorHandling = () => {
    // Catch unhandled errors
    window.addEventListener('error', (event) => {
        errorTracker.trackError(event.error || new Error(event.message), {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
        });
    });

    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
        const error = event.reason instanceof Error
            ? event.reason
            : new Error(String(event.reason));

        errorTracker.trackError(error, {
            type: 'unhandledRejection'
        });
    });

    logger.info('Global error handling initialized');
};

/**
 * Health check utilities
 */
export const healthCheck = {
    checkMemory(): { healthy: boolean; usage: number } {
        if ('memory' in performance && (performance as any).memory) {
            const memory = (performance as any).memory;
            const usagePercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;

            return {
                healthy: usagePercent < 90,
                usage: usagePercent
            };
        }

        return { healthy: true, usage: 0 };
    },

    checkPerformance(): { healthy: boolean; metrics: any } {
        const metrics = performanceMonitor.getAllMetrics();
        const avgTimes = Object.values(metrics).map((m: any) => m.avg);
        const maxAvg = Math.max(...avgTimes, 0);

        return {
            healthy: maxAvg < 10000, // 10 seconds threshold
            metrics
        };
    },

    checkErrors(): { healthy: boolean; errorCount: number } {
        const errors = errorTracker.getErrors();
        const recentErrors = errors.filter(e =>
            Date.now() - e.timestamp.getTime() < 60000 // Last minute
        );

        return {
            healthy: recentErrors.length < 10,
            errorCount: recentErrors.length
        };
    },

    getFullReport() {
        return {
            memory: this.checkMemory(),
            performance: this.checkPerformance(),
            errors: this.checkErrors(),
            timestamp: new Date().toISOString()
        };
    }
};
