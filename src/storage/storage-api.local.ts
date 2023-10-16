import { StorageApi } from "./storage-api";
import { UrlPattern } from "./url-pattern";
import * as LZString from 'lz-string';
import { StorageUsage } from "./storage-usage";
import * as browser from "webextension-polyfill";
import { Logger } from "../helpers/logger";
import { ChromeStorageType } from "./chrome-storage-types";

export class LocalStorageApi extends StorageApi {
    public storageType = ChromeStorageType.Local;

    constructor() {
        super(browser.storage.local);
    }

    public async saveSettingsImpl(values: UrlPattern[]): Promise<any> {
        //No 'per-item' storage limitations in local storage so we can just dump it all into one item
        var optionsRaw = {'config-1': LZString.compressToUTF16(JSON.stringify(values))};
        return optionsRaw;
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
    private async calculateBytesInUse(): Promise<number> {
        try {
            return new TextEncoder().encode(
                Object.entries(await browser.storage.local.get(null))
                .map(([key, value]) => key + JSON.stringify(value))
                .join('')
            ).length;
        } catch (error: any) {
            Logger.getInstance().logError('Error while calculating storage usage: ' + error.message);
            return 0;
        }
    }
}