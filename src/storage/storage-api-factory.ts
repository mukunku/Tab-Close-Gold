import { ChromeStorageType } from "./chrome-storage-types";
import { StorageApi } from "./storage-api";
import { CloudStorageApi } from "./storage-api.cloud";
import { LocalStorageApi } from "./storage-api.local";

export class StorageApiFactory {
    static async getStorageApi(storageType?: ChromeStorageType): Promise<StorageApi> {
        let _storageType =  storageType || await StorageApi.getUserStorageType();
        
        if (_storageType === ChromeStorageType.Cloud)
            return new CloudStorageApi();
        else if (_storageType === ChromeStorageType.Local)
            return new LocalStorageApi();
        else 
            throw new Error(`Tab Close Gold - Unsupported storage setting detected: ${_storageType}`);
    }
}