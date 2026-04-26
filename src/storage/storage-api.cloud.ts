import { StorageApi } from "./storage-api";
import { UrlPattern } from "./url-pattern";
import * as LZString from "lz-string";
import { StorageUsage } from "./storage-usage";
import * as browser from "webextension-polyfill";
import { ChromeStorageType } from "./chrome-storage-types";

export class CloudStorageApi extends StorageApi {
	//Firefox doesn't have the MAX_ITEMS constant so we need to hard code 512 :(
    public static readonly MAX_PARTITION_COUNT: number = (browser.storage.sync.MAX_ITEMS || 512) - 10; //-10 is to reserve some item capacity for settings.

	public storageType = ChromeStorageType.Cloud;

	constructor() {
		super(browser.storage.sync);
	}

    protected preparePatternsForStorage(values: UrlPattern[]): any {
        //Cloud storage has strict limits on storage per config item. so we must partition our data.
        let optionsRaw = this.generatePartitionedOptionsForCloudStorage(values);
        return optionsRaw;
    }

	public async getStorageUsage(): Promise<StorageUsage> {
        let bytesUsed = await browser.storage.sync.getBytesInUse(null); //null = get all usage
        return new StorageUsage(bytesUsed, //Firefox doesn't have the QUOTA_BYTES_PER_ITEM constant so we need to hard code 8192 :(
			(browser.storage.sync.QUOTA_BYTES_PER_ITEM || 8192) * CloudStorageApi.MAX_PARTITION_COUNT);
    }

    private generatePartitionedOptionsForCloudStorage(data: UrlPattern[]): any {
        const chunkSize = Math.max(1, Math.ceil(data.length / CloudStorageApi.MAX_PARTITION_COUNT));
        const chunks: UrlPattern[][] = [];
        for (let i = 0; i < data.length; i += chunkSize) {
            chunks.push(data.slice(i, i + chunkSize));
        }

        const config: any = {};
        for (let i = 0; i < CloudStorageApi.MAX_PARTITION_COUNT; i++) {
            config[`config-${i + 1}`] = i < chunks.length
                ? LZString.compressToUTF16(JSON.stringify(chunks[i]))
                : null;
        }
        return config;
    }

	public async SetByKey(key: string, value: any): Promise<void> {
        return browser.storage.sync.set({ [key]: value });
    }

    public async GetByKey(key: string): Promise<any> {
        const value = await browser.storage.sync.get(key);
        return value[key];
    }

	public RemoveKey(key: string): Promise<void> {
		return browser.storage.sync.remove(key);
	}
}