import { ChromeStorageType } from './chrome-storage-types';
import { MatchBy, UrlPattern } from './url-pattern';
import * as LZString from 'lz-string';
import { StorageUsage } from './storage-usage';
import * as browser from "webextension-polyfill";

export abstract class StorageApi {
    public static readonly LAST_SAVE_DATE_KEY: string = "last-save-date";
    public static readonly DONT_CLOSE_LAST_TAB_KEY: string = "dont-close-last-tab";

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

        function getStorageSettingValue(storageTypeValue: ChromeStorageType) {
            if (storageTypeValue === ChromeStorageType.Cloud) {
                return StorageApi.STORAGE_TYPE_CLOUD;
            } else if (storageTypeValue === ChromeStorageType.Local) {
                return StorageApi.STORAGE_TYPE_LOCAL;
            } else {
                throw new Error(`Unsupported new storage type: ${storageTypeValue}`);
            }
        }

        try {
            //Get new storage location setting. We do this first to verify the new storage type is supported
            let setting = getStorageSettingValue(desiredStorageApi.storageType);

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
        var isPartitionedData = !!(optionsRaw['config-2']);

        let settings: UrlPattern[] = [];
        if (isPartitionedData) {
            let isDone = false;
            let i = 1;
            while (!isDone) {
                var partition = optionsRaw['config-' + i.toString()];
                i++;
                if (partition) {
                    let jsonString = LZString.decompressFromUTF16(partition);
                    if (jsonString) {
                        let settingsPartition = JSON.parse(jsonString) as UrlPattern[];
                        settings = settings.concat(settingsPartition);
                    }
                } else {
                    isDone = true;
                }
            }
        } else if (optionsRaw['config-1']) {
            //Single row of data detected (Usually means we're using Local storage)
            let jsonString = LZString.decompressFromUTF16(optionsRaw['config-1']);
            if (jsonString) {
                settings = JSON.parse(jsonString) as UrlPattern[];
            }
        } else {
            //no items exist. use default demo data
            settings = UrlPattern.DEFAULT_SETTINGS;
        }

        //make sure each setting has valid values. Only needed for new fields but double checking all fields can't hurt
        settings = settings.map(urlPattern => {
            urlPattern.pattern = urlPattern.pattern || "";
            urlPattern.isRegex = urlPattern.isRegex === true ? true : false;
            urlPattern.enabled = urlPattern.enabled === false ? false : true;
            urlPattern.matchBy = urlPattern.matchBy in MatchBy ? urlPattern.matchBy : MatchBy.Url;
            urlPattern.delayInMs = urlPattern.delayInMs !== null && !isNaN(urlPattern.delayInMs) 
                ? urlPattern.delayInMs : 0;
            urlPattern.hitCount = urlPattern.hitCount !== null && !isNaN(urlPattern.hitCount) 
                ? urlPattern.hitCount : 0;
            urlPattern.lastHitOn = urlPattern.lastHitOn !== undefined ? urlPattern.lastHitOn : null;
            urlPattern.lastHits = urlPattern.lastHits || [];
            return urlPattern;
        });

        return settings;
    }

    public async migrateSettings(newStorageApi: StorageApi): Promise<void> {
        const allOptions = await this.browserStorageArea.get(null);
        await newStorageApi.browserStorageArea.set(allOptions);
    }

    public async GetAllJSON(): Promise<string> {
        const rawConfigs = await this.browserStorageArea.get(null);

        //Loop through all items and decompress configs
        for (var properyName in rawConfigs) {
            if (Object.prototype.hasOwnProperty.call(rawConfigs, properyName)) {
                if (properyName.startsWith("config-")) {
                    rawConfigs[properyName] = LZString.decompressFromUTF16(rawConfigs[properyName]);
                }
            }
        }

        return JSON.stringify(rawConfigs, null, 2);
    }
}