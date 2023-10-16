import { Logger } from "./helpers/logger";
import { StorageApi } from "./storage/storage-api";
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

const regexpCache = new Map();
async function inspectUrl(tab: browser.Tabs.Tab, changeInfo: browser.Tabs.OnUpdatedChangeInfoType): Promise<void> {
	try {
		//with great power comes great responsibility
		if (!tab || !tab.id || !changeInfo || !changeInfo.url
			|| UrlPattern.isSystemTab(changeInfo.url)) {
			return;
		}

		const periodicSettingSyncer = await PeriodicSettingSyncer.getInstance();
		let configs = periodicSettingSyncer.configs;
		for (var i = 0; i < configs.length; i++) {
			var config = configs[i];
			if (!config || !config.enabled || !config.pattern || !config.pattern.trim()) { //make sure user didn't save empty string
				continue;
			}

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
				isHit = changeInfo.url.indexOf(pattern) >= 0;
			} else {
				let regex: RegExp = regexpCache.get(pattern);
				if (!regex) {
					regex = new RegExp(pattern);
					regexpCache.set(pattern, regex);
				}

				if (changeInfo.url.search(regex) >= 0) {
					isHit = true;
				}
			}

			if (!isHit) {
				continue;
			}

			if (config.delayInMs > 0) {
				let timeout = Math.min(config.delayInMs, UrlPattern.MAX_DELAY_IN_MILLISECONDS);

				Logger.getInstance()
					.logDebug(`Url '${changeInfo.url}' matched pattern '${pattern}'. Scheduling tab to be closed in ${timeout}ms`);

				setTimeout(async () => {
					await closeTheTab(tab.id!);
					Logger.getInstance()
						.logDebug(`Scheduled tab closed for url '${changeInfo.url}' that matched pattern '${pattern}' after ${timeout}ms`);
				}, timeout);
			} else {
				Logger.getInstance()
					.logDebug(`Url '${changeInfo.url}' matched pattern '${pattern}'. Closing tab.`);

				await closeTheTab(tab.id!);
			}

			config.lastHit = null; //this field isn't used anymore
			config.hitCount++;
			config.lastHitOn = new Date();

			//We keep a rolling window of hits
			config.lastHits = config.lastHits || [];
			config.lastHits.push(changeInfo.url);
			while (config.lastHits.length > UrlPattern.LAST_HIT_HISTORY_COUNT) {
				config.lastHits.shift();
			}

			//Tell the syncer there's new statistics to save
			periodicSettingSyncer.hasNewHits = true;

			return; //we're done! 
		}
		Logger.getInstance().logDebug(`Url '${changeInfo.url}' did not match any patterns.`);
	} catch (error: any) {
		Logger.getInstance()
			.logError(`Something went wrong while processing url '${changeInfo && changeInfo.url}':\n${error.message}`);
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

browser.storage.onChanged.addListener(async (changes, namespace) => {
	if (namespace === "session") {
		return;
	}

	try {
		let haveSavedConfigsChanged = false;
		for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
			if (key === StorageApi.LAST_SAVE_DATE_KEY) {
				//User changed something on the options page. Tell the syncer to refresh configs.
				let periodicSettingSyncer = await PeriodicSettingSyncer.getInstance();
				periodicSettingSyncer.hasNewConfigs = true;
			}

			if (key?.startsWith("config-")) {
				haveSavedConfigsChanged = true;
			} else {
				Logger.getInstance().logDebug(
					`Storage key "${key}" in namespace "${namespace}" changed. ` +
					`Old value was "${oldValue?.toString().substring(0, 20)}", new value is "${newValue?.toString().substring(0, 20)}".`
				);
			}
		}

		if (haveSavedConfigsChanged) {
			Logger.getInstance().logDebug(`Configurations updated in "${namespace}"`);
		}

	} catch (error: any) {
		Logger.getInstance().logError(`Error in browser.storage.onChanged.addListener: ${error.message}`);
	}
});

class PeriodicSettingSyncer {
	private static readonly SYNC_FREQUENCY_MS = 5000;
	private static instance: PeriodicSettingSyncer | null;
	private intervalId: NodeJS.Timeout | null;
	private syncFailureCount: number = 0;
	public hasNewConfigs: boolean = false;
	public hasNewHits: boolean = false;

	public configs: UrlPattern[];

	private constructor() {
		this.configs = [];
		this.intervalId = null;
	}

	private async initialize(): Promise<void> {
		let storageApi = await StorageApiFactory.getStorageApi();
		this.configs = await storageApi.getSettings();
		this.intervalId = setInterval(async () => { await this.sync(); }, PeriodicSettingSyncer.SYNC_FREQUENCY_MS);
	}

	public static async getInstance(): Promise<PeriodicSettingSyncer> {
		if (!PeriodicSettingSyncer.instance) {
			Logger.getInstance().logDebug("PeriodicSettingSyncer: Creating new instance.");
			PeriodicSettingSyncer.instance = new PeriodicSettingSyncer();
			await PeriodicSettingSyncer.instance.initialize();
		}
		return PeriodicSettingSyncer.instance;
	}

	private async sync(): Promise<void> {
		if (!this.hasNewHits && !this.hasNewConfigs) {
			return;
		}

		this.hasNewHits = false;
		clearInterval(this.intervalId!);

		try {
			let storageApi = await StorageApiFactory.getStorageApi();

			if (this.hasNewConfigs) {
				this.hasNewConfigs = false;

				//User made some changes on their options page. So lets fetch the latest settings from storage api
				//and use that as the current settings. This means we will potentially lose up to ~SYNC_FREQUENCY_MS 
				//worth of hit statistics that we were going to be save. But that's less important than deliberate 
				//config changes by the user in my opinion.
				this.configs = await storageApi.getSettings();

				Logger.getInstance().logDebug(`PeriodicSettingSyncer: Option changes detected. Using latest settings from the options page. ` +
					`Hit statistics recorded in the last ${PeriodicSettingSyncer.SYNC_FREQUENCY_MS}ms won't be recorded.`);
				return;
			}

			//There is always the tiny chance that the user might save option changes at the exact moment 
			//this is saving something. But hopefully that won't happen :fingers-crossed:
			await storageApi.saveSettings(this.configs, false);
			this.syncFailureCount = 0;

			Logger.getInstance().logDebug("PeriodicSettingSyncer: synced hit statistic changes.");
		} catch (error: any) {
			this.syncFailureCount++;

			if (this.syncFailureCount % 10 === 0) {
				//I don't know if we'll ever hit this 'if' but adding just in case for now
				Logger.getInstance().logError(`Settings haven't been saved for a while.` +
					`Please export your configs to make sure you don't lose anything and restart your browser.`);
			} else {
				Logger.getInstance().logError(`PeriodicSettingSyncer: Error while syncing configs:\n${error.message}`);
			}
		} finally {
			this.intervalId
				= setInterval(async () => { await this.sync(); }, PeriodicSettingSyncer.SYNC_FREQUENCY_MS);
		}
	}
}