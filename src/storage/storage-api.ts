import { ChromeStorageType } from './chrome-storage-types';
import { UrlPattern } from './url-pattern';
import * as LZString from 'lz-string';
import { StorageUsage } from './storage-usage';
import * as browser from "webextension-polyfill";

export abstract class StorageApi  {
    private static readonly STORAGE_TYPE_CLOUD = { 
        'useCloudStorage' : true 
    };
    private static readonly STORAGE_TYPE_LOCAL = { 
        'useCloudStorage' : false 
    };
    private static readonly STORAGE_TYPE_DEFAULT = StorageApi.STORAGE_TYPE_CLOUD; //All users will be using cloud storage by default

    public abstract getSettings(): Promise<UrlPattern[]>;
    public abstract saveSettings(values: UrlPattern[]): Promise<void>;
    public abstract getStorageUsage(): Promise<StorageUsage>;
    public abstract clearAllSettings(): Promise<void>;
    public abstract saveSettingsRaw(settings: any): Promise<void>; //private abstract is not supported
    protected abstract migrateSettings(newStorageType: ChromeStorageType): Promise<void>;

    public static async getUserStorageType(): Promise<ChromeStorageType> {
        //We always store the user's storage type in the cloud
        let options = await browser.storage.sync.get(StorageApi.STORAGE_TYPE_DEFAULT);
        if (options && options.useCloudStorage) {
            return ChromeStorageType.Cloud;
        } else {
            return ChromeStorageType.Local;
        }
    }

    public async changeUserStorageType(newStorageType: ChromeStorageType): Promise<boolean> {
        if (newStorageType === await StorageApi.getUserStorageType()) {
            return false;
        }

        function getStorageSettingValue(storageTypeValue: ChromeStorageType) {
            if (storageTypeValue === ChromeStorageType.Cloud) {
                return StorageApi.STORAGE_TYPE_CLOUD;
            } else if (storageTypeValue === ChromeStorageType.Local) {
                return StorageApi.STORAGE_TYPE_LOCAL;
            } else {
                throw new Error(`Tab Close Gold - Unsupported new storage type: ${storageTypeValue}`);
            }
        }

        try
        {
            //Get new storage location setting. We do this first to verify the new storage type is supported
            let setting = getStorageSettingValue(newStorageType);

            //Migrate the settings to the new storage location
            await this.migrateSettings(newStorageType);

            //If we got here that means migration was successful, so mark storage type accordingly
            await browser.storage.sync.set(setting);
        } catch(err: any) {
            console.log(`Tab Close Gold - Couldn't switch storage type: ${err?.message}`);
            return false;
        }
        return true;
    }
    
    protected parseSettings(optionsRaw: any): UrlPattern[] {
        //check if the data is partitioned (for cloud storage)
        var isPartitionedData = !!(optionsRaw['config-2']);
        
        let settings: UrlPattern[] = [];
        if (isPartitionedData) {
            let isDone = false;
            let i = 1;
            while(!isDone) {
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
        return settings;
    }
}