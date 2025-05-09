import { StorageApi } from "../storage/storage-api";
import { StorageApiFactory } from "../storage/storage-api-factory";
import { UrlPattern } from "../storage/url-pattern";
import { Logger } from "./logger";
import { Mutex } from 'async-mutex';

export class PeriodicSettingSyncer {
    private static readonly SYNC_FREQUENCY_MS = 2000; //MAX_WRITE_OPERATIONS_PER_HOUR = 1800 -> So max every 2 seconds
    private static instance: PeriodicSettingSyncer | null;
    private static mutex: Mutex = new Mutex();
    private intervalId: NodeJS.Timeout | null;
    private syncFailureCount: number = 0;
    private logger: Logger | undefined | null;
    public hasNewConfigs: boolean = false;
    public hasNewHits: boolean = false;

    public configs: UrlPattern[];
    public dontCloseLastTab: boolean = true;

    private constructor(logger: Logger | undefined | null) {
        this.configs = [];
        this.intervalId = null;
        this.logger = logger;
    }

    private async initialize(): Promise<void> {
        let storageApi = await StorageApiFactory.getStorageApi();
        const configsPromise = storageApi.getSettings();
        const dontCloseLastTabPromise = storageApi.GetByKey(StorageApi.DONT_CLOSE_LAST_TAB_KEY);
        let results = await Promise.all([configsPromise, dontCloseLastTabPromise]);
        this.configs = results[0];
        this.dontCloseLastTab = results[1] !== false; //make sure it's boolean type
        this.intervalId = setInterval(async () => { await this.sync(); }, PeriodicSettingSyncer.SYNC_FREQUENCY_MS);
    }

    public static async getInstance(logger: Logger | undefined | null): Promise<PeriodicSettingSyncer> {
        if (!PeriodicSettingSyncer.instance) {
            const release: Function = await PeriodicSettingSyncer.mutex.acquire();
            try {
                if (!PeriodicSettingSyncer.instance) {
                    const syncer = new PeriodicSettingSyncer(logger);
                    const startTimeMS = performance.now();
                    await syncer.initialize();
                    logger?.logTrace(`PeriodicSettingSyncer: Created new instance in ${performance.now() - startTimeMS}ms.`);
                    PeriodicSettingSyncer.instance = syncer;
                }
            } finally {
                release();
            }
        }
        return PeriodicSettingSyncer.instance;
    }

    private async sync(): Promise<void> {
        if (!this.hasNewHits && !this.hasNewConfigs) {
            return;
        }

        this.hasNewHits = false;
        clearInterval(this.intervalId!);

        try {
            const storageApi = await StorageApiFactory.getStorageApi();

            if (this.hasNewConfigs) {
                this.hasNewConfigs = false;

                //User made some changes on their options page. So lets fetch the latest settings from storage api
                //and use that as the current settings. This means we will potentially lose up to ~SYNC_FREQUENCY_MS 
                //worth of hit statistics that we were going to save. But that's less important than deliberate 
                //config changes by the user in my opinion.
                this.configs = await storageApi.getSettings();

                this.logger?.logTrace("PeriodicSettingSyncer: Option changes detected. Using latest settings from the options page.");
                if (this.hasNewHits) {
                    this.logger?.logWarning(`Hit statistics recorded in the last ${PeriodicSettingSyncer.SYNC_FREQUENCY_MS}ms couldn't be saved due to config changes.`);
                }
                return;
            }

            //There is always the tiny chance that the user might save option changes at the exact moment 
            //this is saving something. But hopefully that won't happen :fingers-crossed:
            await storageApi.saveSettings(this.configs, false);
            this.syncFailureCount = 0;

            this.logger?.logTrace("PeriodicSettingSyncer: saved updated hit statistic.");
        } catch (error: any) {
            this.syncFailureCount++;

            if (this.syncFailureCount % 10 === 0) {
                //I don't know if we'll ever hit this 'if' but adding just in case for now
                this.logger?.logError(`Settings haven't been saved for a while.` +
                    `Please export your configs to make sure you don't lose anything and restart your browser.`);
            } else {
                this.logger?.logError(`PeriodicSettingSyncer: Error while syncing configs:\n${error.message}`);
            }
        } finally {
            this.intervalId = setInterval(async () => { await this.sync(); }, PeriodicSettingSyncer.SYNC_FREQUENCY_MS);
        }
    }
}