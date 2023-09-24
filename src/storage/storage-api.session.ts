import { ChromeStorageType } from "./chrome-storage-types";
import { StorageApi } from "./storage-api";
import { StorageUsage } from "./storage-usage";
import { UrlPattern } from "./url-pattern";
import * as browser from "webextension-polyfill";
import * as LZString from "lz-string";
import { StorageApiFactory } from "./storage-api-factory";

export class SessionStorageApi extends StorageApi {
    public async getSettings(): Promise<UrlPattern[]> {
        let optionsRaw = await browser.storage.session.get(null);
        return super.parseSettings(optionsRaw);
    }

    public async saveSettings(values: UrlPattern[]): Promise<void> {
        if (!values)
            return; // just in case
        
        //No 'per-item' storage limitations in session storage so we can just dump it all into one item
        var optionsRaw = {'config-1': LZString.compressToUTF16(JSON.stringify(values))};
        await browser.storage.session.set(optionsRaw);
    }

    public async getStorageUsage(): Promise<StorageUsage> {
        // @ts-ignore
        if (typeof browser.storage.session.getBytesInUse === 'function') {
            // @ts-ignore
            let bytesUsed = await browser.storage.session.getBytesInUse(null); //null = get all usage
            // @ts-ignore
            return new StorageUsage(bytesUsed, browser.storage.session.QUOTA_BYTES);
        } else { //Firefox
            //Firefox doesn't define a QUOTA_BYTES constant. But their documentation says it's 10MB 
            //which is the same as Chrome's limit. So let's use that instead
            const CHROME_LOCAL_STORAGE_QUOTA_BYTES = 10485760;
            return new StorageUsage(await this.calculateBytesInUse(), CHROME_LOCAL_STORAGE_QUOTA_BYTES);
        }
    }

    //No api to get bytes in use, so lets calculate it ourselves
    public async calculateBytesInUse(): Promise<number> {
        try {
            return new TextEncoder().encode(
                Object.entries(await browser.storage.session.get(null))
                .map(([key, value]) => key + JSON.stringify(value))
                .join('')
            ).length;
        } catch (error) {
            console.log(error);
            return 0;
        }
    }

    public async clearAllSettings(): Promise<void> {
        await browser.storage.session.clear();
    }
    
    public async saveSettingsRaw(settings: any): Promise<void> {
        await browser.storage.session.set(settings);
    }

    protected async migrateSettings(newStorageType: ChromeStorageType): Promise<void> {
        let newStorageApi = await StorageApiFactory.getStorageApi(newStorageType);
		let allOptions = await browser.storage.session.get(null);
		await newStorageApi.saveSettingsRaw(allOptions);
    }
}