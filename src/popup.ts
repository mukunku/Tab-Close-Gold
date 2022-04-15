import { StorageApiFactory } from "./storage/storage-api-factory";
import { UrlPattern } from "./storage/url-pattern";

declare function alert(message: string): void;
declare function prompt(message: string, value: string): string;
declare var window: any;

export class PopupJS {
    private $blacklistButton = $('#blacklist');
    private $optionsButton = $('#options');

    public async init(): Promise<void> {
        this.$blacklistButton.on('click', async () => {
            let tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs && tabs[0]) {
				let currentTab = tabs[0];
				
				if (currentTab.url?.startsWith('chrome-extension') || currentTab.url?.startsWith('chrome:')) {
					alert("Can't blacklist this page");
					window.close();
					return;
				}
				
				var keepRunning = true;
				while (keepRunning) {
					var url = prompt("Confirm blacklist url", PopupJS.domain_from_url(currentTab.url!) || '');
					if (url !== null) { //null => user hit cancel
						if (url.trim()) {
							if (url.length > 3) {
								this.saveNewUrlToStorage(url, currentTab.id!, currentTab.url!);
								keepRunning = false;
							} else {
								alert("Please enter at least 4 characters");
							}
						} else {
							alert("Please enter a value.");
						}
					} else {
						keepRunning = false;
					}
				}
			}
        });

        this.$optionsButton.on('click', () => {
            chrome.runtime.openOptionsPage();
        });
    }

    private static domain_from_url(url: string): string | null {
		let result = null;
		let match;
		if (match = url.match(/^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:\/\n\?\=]+)/im)) {
			result = match[1]
			if (match = result.match(/^[^\.]+\.(.+\..+)$/)) {
				result = match[1]
			}
		}

		return result;
	}

    private async saveNewUrlToStorage(url: string, tabId: number, fullUrl: string): Promise<void> {
        let storageApi = await StorageApiFactory.getStorageApi();
        let configs = await storageApi.getSettings();
		var alreadyExists = false;
        for (var i = 0; i < configs.length; i++) {
            var config = configs[i];
            if (config.pattern.trim() === url.trim()) {
                alreadyExists = true;
                break;
            }
        }
        
        if (!alreadyExists) {
            let newConfig = new UrlPattern(url, false);
            newConfig.lastHits.push(fullUrl);
            newConfig.hitCount = 1;
            newConfig.lastHitOn = new Date();

            configs.push(newConfig);
            await storageApi.saveSettings(configs);
            let tabs = await chrome.tabs.query({ windowType:'normal' });
            if (tabs.length === 1) {
                //If this is the only tab, lets open a blank tab to prevent an infinite loop which can happen in rare cases
                await chrome.tabs.create({ url: "about:blank" });
            }
            await chrome.tabs.remove(tabId);
            window.close(); //close the popup
        } else {
            alert("Url already exists");
        }
    }
}

(function() { 
    new PopupJS().init();
})()