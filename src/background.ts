import { StorageApiFactory } from "./storage/storage-api-factory";
import { UrlPattern } from "./storage/url-pattern";
import * as browser from "webextension-polyfill";

browser.tabs.onUpdated.addListener(async (tabId: number, changeInfo: browser.Tabs.OnUpdatedChangeInfoType, tab: browser.Tabs.Tab) => {
	await inspectUrl(tab, changeInfo);
});

browser.tabs.onReplaced.addListener((addedTabId: number, removedTabId: number) => {
	setTimeout(async () => { 
		let tab = await browser.tabs.get(addedTabId);
		await inspectUrl(tab, { url: tab.url } as browser.Tabs.OnUpdatedChangeInfoType)
	}, 10);	
});

// browser.runtime.onInstalled.addListener(async ({ reason }) => {
// 	if (reason !== 'install') {
// 		return;
// 	}

// 	browser.alarms.create('save-queued-hits-scheduled-job', {
// 		delayInMinutes: 1,
// 		periodInMinutes: 1
// 	});
// });

async function inspectUrl (tab: browser.Tabs.Tab, changeInfo: browser.Tabs.OnUpdatedChangeInfoType): Promise<void> {
	try 
	{
		//with great power comes great responsibility
		if (!tab || !tab.id || !changeInfo || !changeInfo.url 
			|| UrlPattern.isSystemTab(changeInfo.url)) { 
			return;
		} 

		let storageApi = await StorageApiFactory.getStorageApi();
		let configs = await storageApi.getSettings();
		for (var i = 0; i < configs.length; i++) {
			var config = configs[i];
			if (config && config.enabled && config.pattern 
				&& config.pattern.trim()) { //make sure user didn't save empty string
				
				//handle wild cards if necessary
				var isRegex = config.isRegex;
				var pattern = config.pattern.trim();
				if (!isRegex && pattern.includes('*')) {
					// We escape all regex reserved chars except star '*'
					pattern = pattern
								.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
								.replaceAll('*', '.*'); 
					isRegex = true;
				}

				var isHit = false;
				if (!isRegex) {
					isHit = changeInfo.url.includes(pattern);
				} else {
					var regex = new RegExp(pattern);
					if (regex.test(changeInfo.url)) {
						isHit = true;
					}
				}
				
				if (isHit) {
					config.lastHit = null; //this field isn't used anymore
					config.hitCount++;
					config.lastHitOn = new Date();

					//We keep a rolling window of hits
					config.lastHits = config.lastHits || [];
					config.lastHits.push(changeInfo.url);
					while (config.lastHits.length > UrlPattern.LAST_HIT_HISTORY_COUNT) {
						config.lastHits.shift();
					}
					
					//save new hit info
					await storageApi.saveSettings(configs);

					if (config.delayInMs > 0) {
						setTimeout(async () => { 
							await closeTheTab(tab.id!);
						}, Math.min(config.delayInMs, UrlPattern.MAX_DELAY_IN_MILLISECONDS));
					} else {
						await closeTheTab(tab.id!);
					}

					break;
				}
			}
		}
	} catch (error: any) {
		console.log('Tab Close Gold - Error:' + error.message);
	}
}

async function closeTheTab(tabId: number) {
	//check if this is the only tab
	let tabs = await browser.tabs.query({ windowType: 'normal' });
	if (tabs && tabs.length === 1) {
		//lets open a blank tab before closing this one to prevent an infinite loop which can happen in rare cases
		await browser.tabs.create({ url: "about:blank" });
	}

	//Close the tab
	await browser.tabs.remove(tabId);
}