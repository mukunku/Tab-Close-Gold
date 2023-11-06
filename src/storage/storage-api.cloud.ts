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

    public async saveSettingsImpl(values: UrlPattern[]): Promise<any> {
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
		function splitArrayIntoChunksOfLen(arr: Array<any>, len: number) {
			var chunks = [], i = 0, n = arr.length;
			while (i < n) {
				chunks.push(arr.slice(i, i += len));
			}
			return chunks;
		};
			
        var rowCountPerItem = Math.ceil(data.length / CloudStorageApi.MAX_PARTITION_COUNT);
		var splitData = splitArrayIntoChunksOfLen(data, rowCountPerItem);
		
		var config = {} as any;
		for (var i = 0; i < CloudStorageApi.MAX_PARTITION_COUNT; i++) {
			if (i < splitData.length)
				config['config-' + (i + 1).toString()] = LZString.compressToUTF16(JSON.stringify(splitData[i]));
			else
				config['config-' + (i + 1).toString()] = null;
		}
		return config;
	}

	public async SetByKey(key: string, value: any): Promise<void> {
        var keyValue = {} as any;
        keyValue[key] = value;
        return browser.storage.sync.set(keyValue);
    }

    public async GetByKey(key: string): Promise<any> {
        let value: Record<string, any> = await browser.storage.sync.get(key);
        return value[key];
    }
}