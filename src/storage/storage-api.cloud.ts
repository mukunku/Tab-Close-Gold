import { StorageApi } from "./storage-api";
import { UrlPattern } from "./url-pattern";
import LZString from 'lz-string';
import { StorageUsage } from "./storage-usage";
import { ChromeStorageType } from "./chrome-storage-types";
import { StorageApiFactory } from "./storage-api-factory";
import * as browser from "webextension-polyfill";

export class CloudStorageApi extends StorageApi {
	//Firefox doesn't have the MAX_ITEMS constant so we need to hard code 512 :(
    public static readonly MAX_PARTITION_COUNT: number = (browser.storage.sync.MAX_ITEMS || 512) - 10; //-10 is to reserve some item capacity for settings.

    public async getSettings(): Promise<UrlPattern[]> {
        let optionsRaw = await browser.storage.sync.get(null);
        return super.parseSettings(optionsRaw);
    }

    public async saveSettings(values: UrlPattern[]): Promise<void> {
		if (!values)
			return; // just in case

        //Cloud storage has strict limits on storage per config item. so we must partition our data.
        let optionsRaw = this.generatePartitionedOptionsForCloudStorage(values);
        
        await browser.storage.sync.set(optionsRaw);
        await browser.storage.sync.remove('config'); //remove deprecated config (TODO: cleanup later)
    }

	public async getStorageUsage(): Promise<StorageUsage> {
        let bytesUsed = await browser.storage.sync.getBytesInUse(null); //null = get all usage
        return new StorageUsage(bytesUsed, //Firefox doesn't have the QUOTA_BYTES_PER_ITEM constant so we need to hard code 8192 :(
			(browser.storage.sync.QUOTA_BYTES_PER_ITEM || 8192) * CloudStorageApi.MAX_PARTITION_COUNT);
    }

	public async clearAllSettings(): Promise<void> {
        await browser.storage.sync.clear();
    }

	public async migrateSettings(newStorageType: ChromeStorageType): Promise<void> {
		let newStorageApi = await StorageApiFactory.getStorageApi(newStorageType);
		let allOptions = await browser.storage.sync.get(null);
		await newStorageApi.saveSettingsRaw(allOptions);
	}

	public async saveSettingsRaw(settings: any): Promise<void> {
		await browser.storage.sync.set(settings);
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
}