import { ChromeStorageType } from './chrome-storage-types';
import { MatchBy, UrlPattern } from './url-pattern';
import * as LZString from 'lz-string';
import { StorageUsage } from './storage-usage';
import * as browser from "webextension-polyfill";

export abstract class StorageApi {
    public static readonly LAST_SAVE_DATE_KEY: string = "last-save-date";
    public static readonly DONT_CLOSE_LAST_TAB_KEY: string = "dont-close-last-tab";
    public static readonly EXTENSION_PAUSED_UNTIL_KEY: string = "extension-paused-until";
    public static readonly USER_PREFERRED_THEME_KEY: string = "user-preferred-theme";

    private static readonly STORAGE_TYPE_CLOUD = {
        'useCloudStorage': true
    };
    private static readonly STORAGE_TYPE_LOCAL = {
        'useCloudStorage': false
    };
    public static readonly STORAGE_TYPE_DEFAULT = StorageApi.STORAGE_TYPE_CLOUD; //All users will be using cloud storage by default

    private browserStorageArea: browser.Storage.StorageArea;

    public abstract storageType: ChromeStorageType;

    constructor(browserStorageArea: browser.Storage.StorageArea) {
        this.browserStorageArea = browserStorageArea;
    }

    protected abstract preparePatternsForStorage(values: UrlPattern[]): any; 
    public abstract getStorageUsage(): Promise<StorageUsage>;

    public abstract SetByKey(key: string, value: any): Promise<void>;
    public abstract GetByKey(key: string): Promise<any>;
    public abstract RemoveKey(key: string): Promise<void>;

    public async getSettings(): Promise<UrlPattern[]> {
        let optionsRaw = await this.browserStorageArea.get(null);
        return this.parseSettings(optionsRaw);
    }

    public async saveSettings(values: UrlPattern[], updateSaveDate: boolean): Promise<void> {
        let optionsRaw = this.preparePatternsForStorage(values);
        if (updateSaveDate) {
            optionsRaw[StorageApi.LAST_SAVE_DATE_KEY] = new Date().toISOString(); //UTC timezone
        }
        this.browserStorageArea.set(optionsRaw);
    }

    public static async getUserStorageType(): Promise<ChromeStorageType> {
        //We always store the user's storage type in the cloud
        let options = await browser.storage.sync.get(StorageApi.STORAGE_TYPE_DEFAULT);
        if (options && options.useCloudStorage) {
            return ChromeStorageType.Cloud;
        } else {
            return ChromeStorageType.Local;
        }
    }

    public async changeUserStorageType(desiredStorageApi: StorageApi): Promise<boolean> {
        if (desiredStorageApi.storageType === await StorageApi.getUserStorageType()) {
            return false;
        }

        const storageSettingByType: Partial<Record<ChromeStorageType, object>> = {
            [ChromeStorageType.Cloud]: StorageApi.STORAGE_TYPE_CLOUD,
            [ChromeStorageType.Local]: StorageApi.STORAGE_TYPE_LOCAL,
        };

        try {
            const setting = storageSettingByType[desiredStorageApi.storageType];
            if (!setting) {
                throw new Error(`Unsupported new storage type: ${desiredStorageApi.storageType}`);
            }
            //Migrate the settings to the new storage location
            await this.migrateSettings(desiredStorageApi);
            //If we got here that means migration was successful, so mark storage type accordingly
            await browser.storage.sync.set(setting);
        } catch (error: any) {
            //Can't access Logger here due to circular dependencies
            console.error(`Couldn't switch storage type: ${error.message}`);
            return false;
        }
        return true;
    }

    public clearAllSettings(): Promise<void> {
        return this.browserStorageArea.clear();
    }

    private parseSettings(optionsRaw: any): UrlPattern[] {
         //check if the data is partitioned (for cloud storage)
        const isPartitionedData = !!(optionsRaw['config-2']);

        let settings: UrlPattern[] = [];
        if (isPartitionedData) {
            for (let i = 1; ; i++) {
                const partition = optionsRaw['config-' + i];
                if (!partition) break;
                const jsonString = LZString.decompressFromUTF16(partition);
                if (jsonString) {
                    settings = settings.concat(JSON.parse(jsonString) as UrlPattern[]);
                }
            }
        } else if (optionsRaw['config-1']) {
            //Single row of data detected (Usually means we're using Local storage)
            const jsonString = LZString.decompressFromUTF16(optionsRaw['config-1']);
            if (jsonString) {
                settings = JSON.parse(jsonString) as UrlPattern[];
            }
        } else {
            //no items exist. use default demo data
            settings = UrlPattern.DEFAULT_SETTINGS;
        }

        //make sure each setting has valid values. Only needed for new fields but double checking all fields can't hurt
        settings = settings.map(urlPattern => ({
            ...urlPattern,
            pattern: urlPattern.pattern || "",
            isRegex: urlPattern.isRegex === true,
            enabled: urlPattern.enabled !== false,
            matchBy: urlPattern.matchBy in MatchBy ? urlPattern.matchBy : MatchBy.Url,
            delayInMs: urlPattern.delayInMs !== null && !isNaN(urlPattern.delayInMs) ? urlPattern.delayInMs : 0,
            hitCount: urlPattern.hitCount !== null && !isNaN(urlPattern.hitCount) ? urlPattern.hitCount : 0,
            lastHitOn: urlPattern.lastHitOn !== undefined ? urlPattern.lastHitOn : null,
            lastHits: urlPattern.lastHits || [],
        }));

        return settings;
    }

    public async migrateSettings(newStorageApi: StorageApi): Promise<void> {
        const allOptions = await this.browserStorageArea.get(null);
        await newStorageApi.browserStorageArea.set(allOptions);
    }

    public async GetAllJSON(): Promise<string> {
        const rawConfigs = await this.browserStorageArea.get(null);

        //Loop through all items and decompress configs
        for (const key of Object.keys(rawConfigs)) {
            if (key.startsWith("config-")) {
                rawConfigs[key] = LZString.decompressFromUTF16(rawConfigs[key]);
            }
        }

        return JSON.stringify(rawConfigs, null, 2);
    }
}