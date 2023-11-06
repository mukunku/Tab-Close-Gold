import { LocalStorageApi } from "../storage/storage-api.local";
import { CircularLogBuffer } from "./circular-log-buffer";
import { Environment, RuntimeEnvironment } from "./env";
import { Queue } from "./queue";

export class Logger {
    private static readonly SESSION_LOGS_KEY: string = 'session-logs';
    private static readonly KEEP_LAST_N_LOGS: number = 5000;
    private static readonly FLUSH_INTERVAL_MS: number = 2000;
    private static readonly SYNC_FAILURE_THRESHOLD: number = 5;
    private static readonly LOGS_PER_SYNC_BATCH_SIZE: number = 1000;

    private static instance: Logger;
    private storage: LocalStorageApi;
    private queue: Queue<LogRecord>;
    private intervalId: NodeJS.Timeout;
    private syncFailureCount: number = 0;
    private minLogLevel: LogLevel;
    private readonly readonly: boolean = false;

    private constructor(readonly: boolean) {
        this.readonly = readonly;
        this.queue = new Queue<LogRecord>();
        this.intervalId = 0 as unknown as NodeJS.Timeout

        this.storage = new LocalStorageApi();

        if (readonly) {
            this.minLogLevel = LogLevel.None;
            return; //don't do anything else if readonly
        } else if (Environment.getEnvironment() === RuntimeEnvironment.Development) {
            this.minLogLevel = LogLevel.All;
        } else {
            this.minLogLevel = LogLevel.Warning | LogLevel.Error;
        }

        //Flush logs to storage regularly 
        this.intervalId = setInterval(() => this.flush(), Logger.FLUSH_INTERVAL_MS);
    }

    public static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger(false);
        }
        return Logger.instance;
    }

    public static getLogsIterator(ascending: boolean): Promise<Generator<LogRecord, any, unknown>> {
        let readonlyLogger = new Logger(true);
        return readonlyLogger.getLogsIteratorImpl(ascending);
    }

    public async getLogsIteratorImpl(ascending: boolean): Promise<Generator<LogRecord, any, unknown>> {
        let logs = await this.getLogBuffer();
        let iterator = logs[Symbol.iterator](ascending);
        return iterator;
    }

    public logTrace(message: string): void {
        if ((this.minLogLevel & LogLevel.Trace) !== LogLevel.Trace) {
            return;
        }

        console.log(LogRecord.timestampMessage(message));
        this.log(message, LogLevel.Trace);
    }

    public logDebug(message: string): void {
        if ((this.minLogLevel & LogLevel.Debug) !== LogLevel.Debug) {
            return;
        }

        console.log(LogRecord.timestampMessage(message))
        this.log(message, LogLevel.Debug);
    }

    public logWarning(message: string): void {
        if ((this.minLogLevel & LogLevel.Warning) !== LogLevel.Warning) {
            return;
        }

        console.warn(LogRecord.timestampMessage(message));
        this.log(message, LogLevel.Warning);
    }

    public logError(message: string): void {
        if ((this.minLogLevel & LogLevel.Error) !== LogLevel.Error) {
            return;
        }

        console.error(LogRecord.timestampMessage(message));
        this.log(message, LogLevel.Error);
    }

    private log(message: string, logLevel: LogLevel) {
        let log = new LogRecord(message, logLevel);
        this.queue.enqueue(log);
    }

    private async flush(): Promise<void> {
        if (this.queue.isEmpty()) {
            return;
        }

        clearInterval(this.intervalId);

        try {
            try {
                const storageUsage = await this.storage.getStorageUsage();

                let logs = await this.getLogBuffer();

                //Check if we need to downsize due to storage issues
                const isTakingTooMuchSpace = storageUsage.percentage >= 90 && logs.getBufferSize() > 1000 /* always keep some logs */
                const hasFailedToSyncTooManyTimes = this.syncFailureCount >= Logger.SYNC_FAILURE_THRESHOLD;
                if (isTakingTooMuchSpace || hasFailedToSyncTooManyTimes) {
                    logs = new CircularLogBuffer<LogRecord>(Math.max(logs.getBufferSize() / 2, 10));
                }

                let counter = 0;
                while (!this.queue.isEmpty() && counter < Logger.LOGS_PER_SYNC_BATCH_SIZE) {
                    counter++;
                    let logRecord = this.queue.dequeue();
                    if (logRecord) {
                        logs.push(logRecord);
                    }
                }

                await this.storage.SetByKey(Logger.SESSION_LOGS_KEY, logs);
                this.syncFailureCount = 0;
            } catch (error: any) {
                this.syncFailureCount++;
                console.error(error.message);
            }

            if (this.syncFailureCount > Logger.SYNC_FAILURE_THRESHOLD * 2) {
                //Try something drastic. Not sure if we'll ever get to this state but just want to be extra safe
                await this.storage.clearAllSettings();
                console.error("Tab Close Gold - Logging doesn't seem to be working correctly. Please try restarting your browser.");
            }
        } finally {
            this.intervalId = setInterval(() => this.flush(), Logger.FLUSH_INTERVAL_MS);
        }
    }

    private async getLogBuffer(): Promise<CircularLogBuffer<LogRecord>> {
        let logs = await this.storage.GetByKey(Logger.SESSION_LOGS_KEY) as CircularLogBuffer<LogRecord>;

        if (!logs) {
            logs = new CircularLogBuffer<LogRecord>(Logger.KEEP_LAST_N_LOGS);
        }

        return CircularLogBuffer.instantiate(logs);
    }
}

export class LogRecord {
    public readonly message: string;
    public readonly type: LogLevel;
    public readonly date: number;

    constructor(message: string, type: LogLevel) {
        this.message = message || '~';
        this.type = type || LogLevel.Trace;
        this.date = new Date().getTime();
    }

    public renderHtml() {
        const errorColor: string = "#F63E02";
        const warningColor: string = "#FAA300";
        const debugColor: string = "#35342F";
        const traceColor: string = "#5E5C53";

        let boldify = (input: string) => `<b>${input}</b>`;

        if (this.type === LogLevel.Debug) {
            return `<p style="color: ${debugColor};">${LogRecord.timestampMessage(`[DEBUG] ${this.message}`, new Date(this.date), boldify)}</p>`;
        } else if (this.type === LogLevel.Warning) {
            return `<p style="color: ${warningColor};">${LogRecord.timestampMessage(`[WARN ] ${this.message}`, new Date(this.date), boldify)}</p>`;
        } else if (this.type === LogLevel.Error) {
            return `<p style="color: ${errorColor};">${LogRecord.timestampMessage(`[ERROR] ${this.message}`, new Date(this.date), boldify)}</p>`;
        } else {
            return `<p style="color: ${traceColor};">${LogRecord.timestampMessage(`[TRACE] ${this.message}`, new Date(this.date), boldify)}</p>`;
        }
    }

    public static timestampMessage(message: string, date?: Date, timestampFormatter?: (timestamp: string) => string): string {
        let timezoneOffset = (date || new Date()).getTimezoneOffset() * 60000; //offset in milliseconds
        let localISOTime = (new Date((date?.valueOf() || Date.now()) - timezoneOffset))
            .toISOString().slice(0, -1).replace("T", " ");

        const timestamp = timestampFormatter ? timestampFormatter(`[${localISOTime}]`) : `[${localISOTime}] `;
        return timestamp + " " + message;
    }

    public static instantiate(deserializedObject: LogRecord): LogRecord {
        if (!deserializedObject) {
            return deserializedObject;
        }

        //we need to do this so the object has its functions attached
        return Object.assign(new LogRecord('', LogLevel.Trace), deserializedObject);
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