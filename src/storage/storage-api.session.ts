import { StorageApi } from "./storage-api";
import { StorageUsage } from "./storage-usage";
import { UrlPattern } from "./url-pattern";
import * as browser from "webextension-polyfill";
import * as LZString from "lz-string";
import { ChromeStorageType } from "./chrome-storage-types";

export class SessionStorageApi extends StorageApi {
    public storageType = ChromeStorageType.Session;

    constructor() {
        super(browser.storage.session);
    }

    protected preparePatternsForStorage(values: UrlPattern[]): any {
        //No 'per-item' storage limitations in session storage so we can just dump it all into one item
        var optionsRaw = { 'config-1': LZString.compressToUTF16(JSON.stringify(values)) };
        return optionsRaw;
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
            const CHROME_SESSION_STORAGE_QUOTA_BYTES = 10485760;
            return new StorageUsage(await this.calculateBytesInUse(), CHROME_SESSION_STORAGE_QUOTA_BYTES);
        }
    }

    //No api to get bytes in use, so lets calculate it ourselves
    private async calculateBytesInUse(): Promise<number> {
        try {
            return new TextEncoder().encode(
                Object.entries(await browser.storage.session.get(null))
                    .map(([key, value]) => key + JSON.stringify(value))
                    .join('')
            ).length;
        } catch (error: any) {
            //Can't use Logger here due to circular reference
            console.error('Error while calculating storage usage: ' + error.message);
            return 0;
        }
    }

    public async SetByKey(key: string, value: any): Promise<void> {
        var keyValue = {} as any;
        keyValue[key] = value;
        return browser.storage.session.set(keyValue);
    }

    public async GetByKey(key: string): Promise<any> {
        let value: Record<string, any> = await browser.storage.session.get(key);
        return value[key];
    }
}