import { StorageApi } from "./storage-api";
import { UrlPattern } from "./url-pattern";
import * as LZString from 'lz-string';
import { StorageUsage } from "./storage-usage";
import { StorageApiFactory } from "./storage-api-factory";
import { ChromeStorageType } from "./chrome-storage-types";
import * as browser from "webextension-polyfill";

export class LocalStorageApi extends StorageApi {
    public async getSettings(): Promise<UrlPattern[]> {
        let optionsRaw = await browser.storage.local.get(null);
        return super.parseSettings(optionsRaw);
    }

    public async saveSettings(values: UrlPattern[]): Promise<void> {
        if (!values)
			return; // just in case
            
        //No 'per-item' storage limitations in local storage so we can just dump it all into one item
        var optionsRaw = {'config-1': LZString.compressToUTF16(JSON.stringify(values))};
        await browser.storage.local.set(optionsRaw);
        await browser.storage.sync.remove('config'); //remove deprecated config (TODO: cleanup later)
    }

    public async getStorageUsage(): Promise<StorageUsage> {
        // @ts-ignore
        if (typeof browser.storage.local.getBytesInUse === 'function') {
            // @ts-ignore
            let bytesUsed = await browser.storage.local.getBytesInUse(null); //null = get all usage
            return new StorageUsage(bytesUsed, browser.storage.local.QUOTA_BYTES);
        } else { //Firefox
            //Firefox doesn't define a QUOTA_BYTES constant. Their documetation says they can't provide
            //an exact number ?! So let's hard code Chrome's QUOTA_BYTES value as a best effort *shrug*
            const CHROME_LOCAL_STORAGE_QUOTA_BYTES = 10485760;
            return new StorageUsage(await this.calculateBytesInUse(), CHROME_LOCAL_STORAGE_QUOTA_BYTES);
        }
    }

    //HACK: Firefox has a bug so cant get usage info for local storage: https://bugzilla.mozilla.org/show_bug.cgi?id=1385832
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
        await browser.storage.local.clear();
    }

    public async migrateSettings(newStorageType: ChromeStorageType): Promise<void> {
		let newStorageApi = await StorageApiFactory.getStorageApi(newStorageType);
		let allOptions = await browser.storage.local.get(null);
		await newStorageApi.saveSettingsRaw(allOptions);
	}

	public async saveSettingsRaw(settings: any): Promise<void> {
		await browser.storage.local.set(settings);
	}
}