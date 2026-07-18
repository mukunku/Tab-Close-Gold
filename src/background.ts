import { Mutex } from "async-mutex";
import { Logger } from "./helpers/logger";
import { PeriodicSettingSyncer } from "./helpers/periodic-setting-syncer";
import { StorageApi } from "./storage/storage-api";
import { MatchBy, UrlPattern } from "./storage/url-pattern";
import * as browser from "webextension-polyfill";
import { setIconEnabled, setIconDisabled } from "./helpers/utilities";
import { LocalStorageApi } from "./storage/storage-api.local";

//hydrate the cache to speed up tab inspections
Logger.getInstance().then((logger) => {
	PeriodicSettingSyncer.getInstance(logger)
});

//need to periodically check to see if we need to pause or re-enable the extension
const PAUSE_CHECK_INTERVAL_MS = 500;
let isExtensionPaused = false; 
let pauseIntervalId = setInterval(async () => { await checkExtensionPause(true); }, PAUSE_CHECK_INTERVAL_MS);

browser.tabs.onUpdated.addListener(async (tabId: number, changeInfo: browser.Tabs.OnUpdatedChangeInfoType, tab: browser.Tabs.Tab) => {
	await inspectUrl(tab, changeInfo);
});

browser.tabs.onReplaced.addListener((addedTabId: number, removedTabId: number) => {
	setTimeout(async () => {
		let tab = await browser.tabs.get(addedTabId);
		await inspectUrl(tab, { url: tab.url, title: tab.title } as browser.Tabs.OnUpdatedChangeInfoType);
	}, 10);
});

const regexpCache = new Map<string, RegExp>();
function containsString(input?: string, searchPattern?: string, isRegex?: boolean): boolean {
	if (!input || !searchPattern) {
		return false;
	}

	var isHit = false;
	if (!isRegex) {
		isHit = input.indexOf(searchPattern) >= 0;
	} else {
		let regex = regexpCache.get(searchPattern);
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
		if (isExtensionPaused) {
			logger.logTrace(`Skipping checks for '${tabUrl}' and '${tabTitle}' because the extension is paused.`);
			return;
		}

		const periodicSettingSyncer = await PeriodicSettingSyncer.getInstance(logger);
		let configs = periodicSettingSyncer.configs;
		for (var i = 0; i < configs.length; i++) {
			var config = configs[i];
			if (!config || !config.enabled || !config.pattern || !config.pattern.trim()) { //make sure user didn't save empty string
				continue;
			}

			Logger.logTrace(`Checking '${tabUrl}' and '${tabTitle}' against pattern ${config.pattern} with ${MatchBy[config.matchBy]}`);

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
			let matchedBy: string = "";
			if (tabUrl && (matchBy === MatchBy.Url || matchBy === MatchBy.Url_or_Title)) {
				if (!config.isRegex) {
					isHit = containsString(tabUrl.toLocaleLowerCase(), pattern.toLocaleLowerCase(), isRegex);
				} else {
					isHit = containsString(tabUrl, pattern, isRegex);
				}

				matchedPattern = tabUrl;
				matchedBy = "Url"
			}

			if (!isHit && tabTitle && (matchBy === MatchBy.Title || matchBy === MatchBy.Url_or_Title)) {
				if (!config.isRegex) {
					isHit = containsString(tabTitle.toLocaleLowerCase(), pattern.toLocaleLowerCase(), isRegex);
				} else {
					isHit = containsString(tabTitle, pattern, isRegex);
				}

				matchedPattern = tabTitle;
				matchedBy = "Title";
			}

			if (!isHit) {
				continue;
			}

			const saveHit = () => {
				config.hitCount++;
				config.lastHitOn = new Date();

				//We keep a rolling window of hits
				config.lastHits = config.lastHits || [];
				config.lastHits.push(matchedPattern.length > UrlPattern.MAX_LAST_HIT_LENGTH ? `${matchedPattern.substring(0, UrlPattern.MAX_LAST_HIT_LENGTH)}...` : matchedPattern);
				while (config.lastHits.length > UrlPattern.LAST_HIT_HISTORY_COUNT) {
					config.lastHits.shift();
				}

				//Tell the syncer there's new statistics to save
				periodicSettingSyncer.hasNewHits = true;
			}

			if (config.delayInMs > 0) {
				let timeout = Math.min(config.delayInMs, UrlPattern.MAX_DELAY_IN_MILLISECONDS);

				Logger.logDebug(`${matchedBy} '${matchedPattern}' matched pattern '${pattern}'. Scheduling tab to be closed in ${timeout}ms`);

				setTimeout(async () => {
					await attemptTabClose(
						tabId!, periodicSettingSyncer.dontCloseLastTab, matchedBy, matchedPattern, pattern, saveHit,
						`Scheduled tab closing for ${matchedBy} '${matchedPattern}' that matched pattern '${pattern}' after ${timeout}ms`
					);
				}, timeout);
			} else { // close the tab immediately
				await attemptTabClose(
					tabId!, periodicSettingSyncer.dontCloseLastTab, matchedBy, matchedPattern, pattern, saveHit,
					`${matchedBy} '${matchedPattern}' matched pattern '${pattern}'. Tab has been closed.`
				);
			}

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
		Logger.logError(`Something went wrong while processing url '${tabUrl}' with title '${tabTitle}': ${error.message}`);
	}
}

async function attemptTabClose(
	tabId: number,
	dontCloseLastTab: boolean,
	matchedBy: string,
	matchedPattern: string,
	pattern: string,
	saveHit: () => void,
	successMessage: string
): Promise<void> {
	let wasClosed = false;
	try {
		wasClosed = await closeTheTab(tabId, dontCloseLastTab);
		if (wasClosed) {
			saveHit();
		}
	} catch (error: any) {
		if (IsTabDoesNotExistError(error)) {
			Logger.logTrace(`Tab ${tabId} was already closed for ${matchedBy} '${matchedPattern}' that matched pattern '${pattern}'`);
		} else {
			Logger.logError(`Something went wrong while closing tab ${tabId} for ${matchedBy} '${matchedPattern}' that matched pattern '${pattern}': ${error.message}`);
		}
	} finally {
		if (wasClosed) {
			Logger.logDebug(successMessage);
		}
	}
}

//Distinguishes "tab was already closed by another call" (expected, benign) from real failures
// E.g. Tab might not exist if it matched by both Url and Title since one will be faster to close the tab before the other
function IsTabDoesNotExistError(error: any): boolean {
	const errorMessage = error?.message || "";
	return errorMessage.startsWith("No tab with id:") /*Chrome*/ || errorMessage.startsWith("Invalid tab ID:") /*Firefox*/;
}

async function closeTheTab(tabId: number, dontCloseLastTab: boolean): Promise<boolean> {
	//We need exclusive access to tabs so hit statistics are accurate. This is because
	//we now allow matching by title and url so if both match that counts as two hits without locking.
	const release = await (await acquireTabLock(tabId)).acquire();
	try {
		const tabsPromise = browser.tabs.query({ windowType: 'normal' });

		if (dontCloseLastTab) {
			const tabs = await tabsPromise;

			//tab may have already been closed by an earlier/concurrent scheduled or immediate close
			if (!tabs.some(tab => tab.id === tabId)) {
				Logger.logTrace(`Tab ${tabId} not found`);
				return false;
			}

			if (tabs.length === 1) {
				Logger.logTrace(`Tab ${tabId} is the only tab open. Creating a blank tab before closing it.`);

				//lets open a blank tab before closing the last one
				await browser.tabs.create({ url: "about:blank" });
			}
		}

		//close first, ask questions later
		Logger.logTrace(`Closing tab ${tabId}`);
		await browser.tabs.remove(tabId);

		Logger.logTrace(`Tab ${tabId} closed successfully`);
		return true;
	} finally {
		release();
	}
}

const tabIdMutex = new Map<number, Mutex>(); //This gets periodically cleared as the background script goes inactive
async function acquireTabLock(tabId: number): Promise<Mutex> {
	let mutex = tabIdMutex.get(tabId);
	if (!mutex) {
		const release = await new Mutex().acquire();
		try {
			mutex = tabIdMutex.get(tabId);
			if (!mutex) {
				mutex = new Mutex();
				tabIdMutex.set(tabId, mutex);
			}
		} finally {
			release();
		}
	}
	return mutex;
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
			} else if (key === StorageApi.DONT_CLOSE_LAST_TAB_KEY) {
				const logger = await Logger.getInstance();
				let periodicSettingSyncer = await PeriodicSettingSyncer.getInstance(logger);
				periodicSettingSyncer.dontCloseLastTab = newValue as boolean;
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

async function checkExtensionPause(isFirstRun: boolean) {
	clearInterval(pauseIntervalId);
	const localStorageApi = new LocalStorageApi();
	const pausedUntil = await localStorageApi.GetByKey(StorageApi.EXTENSION_PAUSED_UNTIL_KEY);
	if (pausedUntil && !isNaN(pausedUntil)) {
		isExtensionPaused = pausedUntil - Date.now() > 0;
		if (!isExtensionPaused) {
			setIconEnabled();
			await localStorageApi.RemoveKey(StorageApi.EXTENSION_PAUSED_UNTIL_KEY);
		} else if (isFirstRun) {
			//If the user closes the browser while the extension is paused, we need to update the icon accordingly upon first launch
			setIconDisabled();
		}
	} else {
		isExtensionPaused = false;
	}
	pauseIntervalId = setInterval(async () => { await checkExtensionPause(false); }, PAUSE_CHECK_INTERVAL_MS);
}