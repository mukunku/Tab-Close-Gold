import { SessionStorageApi } from "../storage/storage-api.session";
import { CircularLogBuffer } from "./circular-log-buffer";
import { Queue } from "./queue";

export class Logger {
    private static readonly SESSION_LOGS_KEY: string = 'session-logs';
    private static readonly KEEP_LAST_N_LOGS: number = 100000; 
    private static readonly FLUSH_INTERVAL_MS: number = 5000;

    private static instance: Logger;
    private sessionLogger: SessionStorageApi;
    private queue: Queue<LogRecord>;
    private intervalId: NodeJS.Timeout;

    private constructor() {
        this.sessionLogger = new SessionStorageApi();
        this.sessionLogger.SetByKey(Logger.SESSION_LOGS_KEY, new CircularLogBuffer<LogRecord>(Logger.KEEP_LAST_N_LOGS));
        this.queue = new Queue<LogRecord>();

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
        this.log(message, LogType.Trace);
    }

    public logDebug(message: string): void {
        this.log(message, LogType.Debug);
    }

    public logWarning(message: string): void {
        console.warn('Tab Close Gold: ' + message);
        this.log(message, LogType.Warning);
    }

    public logError(message: string): void {
        console.error('Tab Close Gold: ' + message);
        this.log(message, LogType.Error);
    }

    private log(message: string, logType: LogType) {
        let log = new LogRecord(message, logType);
        this.queue.enqueue(log);
    }

    private async flush(): Promise<void> {
        clearInterval(this.intervalId);

        try {
            let storageUsage = await this.sessionLogger.getStorageUsage();
            let areLogsTakingUpTooMuchSpace = storageUsage.percentage >= 90;
                
            let logs = await this.sessionLogger.GetByKey(Logger.SESSION_LOGS_KEY) as CircularLogBuffer<LogRecord>;
            logs =  Object.assign(new CircularLogBuffer<LogRecord>(0), logs); //We need to do this so we have the push() method available
            if (areLogsTakingUpTooMuchSpace && logs.getBufferSize() > 1000 /* always keep some logs */) {
                logs = new CircularLogBuffer<LogRecord>(logs.getBufferSize() / 2);
            }

            while (!this.queue.isEmpty()) {
                let logRecord = this.queue.dequeue();
                if (logRecord) {
                    logs.push(logRecord);
                }
            }
            
            this.sessionLogger.SetByKey(Logger.SESSION_LOGS_KEY, logs);
        } catch (error: any) {
            console.error(error.message);
        }

        this.intervalId = setInterval(() => this.flush(), Logger.FLUSH_INTERVAL_MS);
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