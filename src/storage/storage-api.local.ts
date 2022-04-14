import { StorageApi } from "./storage-api";
import { UrlPattern } from "./url-pattern";
import LZString from 'lz-string';
import { StorageUsage } from "./storage-usage";
import { StorageApiFactory } from "./storage-api-factory";
import { ChromeStorageType } from "./chrome-storage-types";

export class LocalStorageApi extends StorageApi {
    public async getSettings(): Promise<UrlPattern[]> {
        let optionsRaw = await chrome.storage.local.get(null);
        return super.parseSettings(optionsRaw);
    }

    public async saveSettings(values: UrlPattern[]): Promise<void> {
        if (!values)
			return; // just in case
            
        //No 'per-item' storage limitations in local storage so we can just dump it all into one item
        var optionsRaw = {'config-1': LZString.compressToUTF16(JSON.stringify(values))};
        await chrome.storage.local.set(optionsRaw);
        await chrome.storage.sync.remove('config'); //remove deprecated config (TODO: cleanup later)
    }

    public async getStorageUsage(): Promise<StorageUsage> {
        let bytesUsed = await chrome.storage.local.getBytesInUse(null); //null = get all usage
        return new StorageUsage(bytesUsed, chrome.storage.local.QUOTA_BYTES);
    }

    public async clearAllSettings(): Promise<void> {
        await chrome.storage.local.clear();
    }

    public async migrateSettings(newStorageType: ChromeStorageType): Promise<void> {
		let newStorageApi = await StorageApiFactory.getStorageApi(newStorageType);
		let allOptions = await chrome.storage.local.get(null);
		await newStorageApi.saveSettingsRaw(allOptions);
	}

	public async saveSettingsRaw(settings: any): Promise<void> {
		await chrome.storage.local.set(settings);
	}
}