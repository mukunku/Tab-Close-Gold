import { SessionStorageApi } from "../storage/storage-api.session";
import { CircularLogBuffer } from "./circular-log-buffer";
import { Environment, RuntimeEnvironment } from "./env";
import { Queue } from "./queue";

export class Logger {
    private static readonly SESSION_LOGS_KEY: string = 'session-logs';
    private static readonly KEEP_LAST_N_LOGS: number = 100000;
    private static readonly FLUSH_INTERVAL_MS: number = 2000;
    private static readonly SYNC_FAILURE_THRESHOLD: number = 5;
    private static readonly LOGS_PER_SYNC_BATCH_SIZE: number = 1000;

    private static instance: Logger;
    private sessionLogger: SessionStorageApi;
    private queue: Queue<LogRecord>;
    private intervalId: NodeJS.Timeout;
    private syncFailureCount: number = 0;
    private logLevel: LogLevel;

    private constructor() {
        this.sessionLogger = new SessionStorageApi();
        this.sessionLogger.SetByKey(Logger.SESSION_LOGS_KEY, new CircularLogBuffer<LogRecord>(Logger.KEEP_LAST_N_LOGS));
        this.queue = new Queue<LogRecord>();

        if (Environment.getEnvironment() === RuntimeEnvironment.Development) {
            this.logLevel = LogLevel.All;
        } else {
            this.logLevel = LogLevel.Warning | LogLevel.Error;
        }

        //Flush logs to session storage regularly 
        this.intervalId = setInterval(() => this.flush(), Logger.FLUSH_INTERVAL_MS);
    }

    public static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    public logTrace(message: string): void {
        if ((this.logLevel & LogLevel.Trace) !== LogLevel.Trace) {
            return;
        }

        message = Logger.timestampMessage(message);
        console.log(message);
        this.log(message, LogType.Trace);
    }

    public logDebug(message: string): void {
        if ((this.logLevel & LogLevel.Debug) !== LogLevel.Debug) {
            return;
        }

        message = Logger.timestampMessage(message);
        console.log(message)
        this.log(message, LogType.Debug);
    }

    public logWarning(message: string): void {
        if ((this.logLevel & LogLevel.Warning) !== LogLevel.Warning) {
            return;
        }

        message = Logger.timestampMessage(message);
        console.warn(message);
        this.log(message, LogType.Warning);
    }

    public logError(message: string): void {
        if ((this.logLevel & LogLevel.Error) !== LogLevel.Error) {
            return;
        }

        message = Logger.timestampMessage(message);
        console.error(message);
        this.log(message, LogType.Error);
    }

    private log(message: string, logType: LogType) {
        let log = new LogRecord(message, logType);
        this.queue.enqueue(log);
    }

    private static timestampMessage(message: string): string {
        let timezoneOffset = (new Date()).getTimezoneOffset() * 60000; //offset in milliseconds
        let localISOTime = (new Date(Date.now() - timezoneOffset))
            .toISOString().slice(0, -1).replace("T", " ");

        return `[${localISOTime}] ` + message;
    }

    private async flush(): Promise<void> {
        if (this.queue.isEmpty()) {
            return;
        }
        
        clearInterval(this.intervalId);

        try {
            try {
                const storageUsage = await this.sessionLogger.getStorageUsage();

                let logs = await this.sessionLogger.GetByKey(Logger.SESSION_LOGS_KEY) as CircularLogBuffer<LogRecord>;
                logs = Object.assign(new CircularLogBuffer<LogRecord>(0), logs); //We need to do this so we have the push() method available

                //Check if we need to downsize due to storage issues
                const isTakingTooMuchSpace = storageUsage.percentage >= 90 && logs.getBufferSize() > 1000 /* always keep some logs */
                const hasFailedToSyncTooManyTimes = this.syncFailureCount >= Logger.SYNC_FAILURE_THRESHOLD;
                if (isTakingTooMuchSpace || hasFailedToSyncTooManyTimes) {
                    logs = new CircularLogBuffer<LogRecord>(logs.getBufferSize() / 2);
                }

                let counter = 0;
                while (!this.queue.isEmpty() && counter < Logger.LOGS_PER_SYNC_BATCH_SIZE) {
                    counter++;
                    let logRecord = this.queue.dequeue();
                    if (logRecord) {
                        logs.push(logRecord);
                    }
                }

                this.sessionLogger.SetByKey(Logger.SESSION_LOGS_KEY, logs);
                this.syncFailureCount = 0;
            } catch (error: any) {
                this.syncFailureCount++;
                console.error(error.message);
            }

            if (this.syncFailureCount > Logger.SYNC_FAILURE_THRESHOLD * 2) {
                //Try something drastic. Not sure if we'll ever get to this state but just want to be extra safe
                await this.sessionLogger.clearAllSettings();
                console.error("Tab Close Gold - Logging doesn't seem to be working correctly. Please try restarting your browser.");
            }
        } finally {
            this.intervalId = setInterval(() => this.flush(), Logger.FLUSH_INTERVAL_MS);
        }
    }
}

enum LogType {
    Trace,
    Debug,
    Warning,
    Error
}

class LogRecord {
    public message: string;
    public type: LogType;
    public date: Date;

    constructor(message: string, type: LogType) {
        this.message = message || '~';
        this.type = type || LogType.Trace;
        this.date = new Date();
    }
}

export enum LogLevel {
    None = 0,
    Trace = 1 << 0, 
    Debug = 1 << 1, 
    Warning = 1 << 2,  
    Error = 1 << 3, 
    All = ~(~0 << 4) 
}