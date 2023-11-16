import { Logger } from "./helpers/logger";
import { PeriodicSettingSyncer } from "./helpers/periodic-setting-syncer";
import { StorageApi } from "./storage/storage-api";
import { MatchBy, UrlPattern } from "./storage/url-pattern";
import * as browser from "webextension-polyfill";

browser.tabs.onUpdated.addListener(async (tabId: number, changeInfo: browser.Tabs.OnUpdatedChangeInfoType, tab: browser.Tabs.Tab) => {
	await inspectUrl(tab, changeInfo);
});

browser.tabs.onReplaced.addListener((addedTabId: number, removedTabId: number) => {
	setTimeout(async () => {
		let tab = await browser.tabs.get(addedTabId);
		await inspectUrl(tab, { url: tab.url, title: tab.title } as browser.Tabs.OnUpdatedChangeInfoType)
	}, 10);
});

const regexpCache = new Map();
function containsString(input?: string, searchPattern?: string, isRegex?: boolean): boolean {
	if (!input || !searchPattern) {
		return false;
	}

	var isHit = false;
	if (!isRegex) {
		isHit = input.indexOf(searchPattern) >= 0;
	} else {
		let regex: RegExp = regexpCache.get(searchPattern);
		if (!regex) {
			regex = new RegExp(searchPattern);
			regexpCache.set(searchPattern, regex);
		}

		if (input.search(regex) >= 0) {
			isHit = true;
		}
	}
	return isHit;
}

async function inspectUrl(tab: browser.Tabs.Tab, changeInfo: browser.Tabs.OnUpdatedChangeInfoType): Promise<void> {
	const tabId = tab && tab.id;
	const tabTitle = changeInfo && changeInfo.title;
	const tabUrl = changeInfo && changeInfo.url;

	try {
		//Make sure we have a url or title
		if ((!tabUrl && !tabTitle) || isNaN(tabId!)) {
			return;
		}

		//with great power comes great responsibility
		if (UrlPattern.isSystemTab(tabUrl, tabTitle)) {
			Logger.logTrace(`Skipping system tab with url '${tabUrl}' and title '${tabTitle}'`);
			return;
		}

		const logger = await Logger.getInstance();
		const periodicSettingSyncer = await PeriodicSettingSyncer.getInstance(logger);
		let configs = periodicSettingSyncer.configs;
		for (var i = 0; i < configs.length; i++) {
			var config = configs[i];
			if (!config || !config.enabled || !config.pattern || !config.pattern.trim()) { //make sure user didn't save empty string
				continue;
			}

			Logger.logTrace(`Checking '${tabUrl}' and '${tabTitle}' against pattern ${config.pattern}`);

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

			let isHit = false;
			const matchBy = config.matchBy || MatchBy.Url;
			let matchedPattern: string = "";
			if (tabUrl && (matchBy === MatchBy.Url || matchBy === MatchBy.Url_or_Title)) {
				if (!config.isRegex) {
					isHit = containsString(tabUrl.toLocaleLowerCase(), pattern.toLocaleLowerCase(), isRegex);
				} else {
					isHit = containsString(tabUrl, pattern, isRegex);
				}

				matchedPattern = tabUrl;
			}

			if (!isHit && tabTitle && (matchBy === MatchBy.Title || matchBy === MatchBy.Url_or_Title)) {
				if (!config.isRegex) {
					isHit = containsString(tabTitle.toLocaleLowerCase(), pattern.toLocaleLowerCase(), isRegex);
				} else {
					isHit = containsString(tabTitle, pattern, isRegex);
				}

				matchedPattern = tabTitle;
			}

			if (!isHit) {
				continue;
			}

			if (config.delayInMs > 0) {
				let timeout = Math.min(config.delayInMs, UrlPattern.MAX_DELAY_IN_MILLISECONDS);

				Logger.logDebug(`'${matchedPattern}' matched pattern '${pattern}'. Scheduling tab to be closed in ${timeout}ms`);

				setTimeout(async () => {
					Logger.logDebug(`Scheduled tab closing for '${matchedPattern}' that matched pattern '${pattern}' after ${timeout}ms`);
					await closeTheTab(tab.id!);
				}, timeout);
			} else {
				Logger.logDebug(`'${matchedPattern}' matched pattern '${pattern}'. Closing tab.`);
				await closeTheTab(tabId!);
			}

			config.lastHit = null; //this field isn't used anymore
			config.hitCount++;
			config.lastHitOn = new Date();

			//We keep a rolling window of hits
			config.lastHits = config.lastHits || [];
			config.lastHits.push(matchedPattern);
			while (config.lastHits.length > UrlPattern.LAST_HIT_HISTORY_COUNT) {
				config.lastHits.shift();
			}

			//Tell the syncer there's new statistics to save
			periodicSettingSyncer.hasNewHits = true;

			return; //we're done! 
		}

		if (tabUrl && tabTitle) {
			Logger.logDebug(`Url '${tabUrl}' with Title '${tabTitle}' did not match any patterns`);
		} else if (tabUrl) {
			Logger.logDebug(`Url '${tabUrl}' did not match any patterns`);
		} else if (tabTitle) {
			Logger.logDebug(`Title '${tabTitle}' did not match any patterns`);
		} else {
			Logger.logError(`No tab url or title was inspected. This should not normally happen`);
		}
	} catch (error: any) {
		const errorMessage = error?.message || "";

		//Tab might not exist if it matched by both Url and Title since one will be faster to close the tab before the other
		if (!errorMessage.startsWith("No tab with id:")) {
			Logger.logError(`Something went wrong while processing url '${tabUrl}' with title '${tabTitle}': ${error.message}`);
		} else {
			Logger.logTrace(`Tab with url '${tabUrl}' and title '${tabTitle}' was already closed`)
		}
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
	if (namespace !== "sync") {
		return;
	}

	try {
		let haveSavedConfigsChanged = false;
		for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
			if (key === StorageApi.LAST_SAVE_DATE_KEY) {
				const logger = await Logger.getInstance();

				//User changed something on the options page. Tell the syncer to refresh configs.
				let periodicSettingSyncer = await PeriodicSettingSyncer.getInstance(logger);
				periodicSettingSyncer.hasNewConfigs = true;
			}

			if (key?.startsWith("config-")) {
				haveSavedConfigsChanged = true;
			} else { 
				Logger.logTrace(
					`Storage key "${key}" in namespace "${namespace}" changed. ` +
					`Old value was "${oldValue?.toString().substring(0, 20)}", new value is "${newValue?.toString().substring(0, 20)}".`
				);
			}
		}

		if (haveSavedConfigsChanged) {
			Logger.logTrace(`Configurations updated in "${namespace}"`);
		}

	} catch (error: any) {
		Logger.logError(`Error in browser.storage.onChanged.addListener: ${error.message}`);
	}
});