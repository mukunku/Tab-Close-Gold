import { Environment } from "./helpers/env";
import { StorageApiFactory } from "./storage/storage-api-factory";
import { MatchBy, UrlPattern } from "./storage/url-pattern";
import * as browser from "webextension-polyfill";

export class PopupJS {
    private $blacklistButton = $('#blacklist');
    private $optionsButton = $('#options');
    private $body = $('body');

    public async init(): Promise<void> {
        this.$blacklistButton.on('click', async () => {
            let tabs = await browser.tabs.query({ active: true, currentWindow: true });
            if (tabs && tabs[0]) {
                let currentTab = tabs[0];

                if (Environment.isFirefox()) {
                    //HACK: the prompt doesn't fit into the popup in firefox so we need to resize the popup...
                    this.$body.height(this.$body.height()! + 100);
                    this.$body.width(this.$body.width()! + 200);
                }

                if (UrlPattern.isSystemTab(currentTab.url!, null)) {
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
                                await this.saveNewUrlToStorage(url, currentTab.id!, currentTab.url!);
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
                window.close();
            }
        });

        this.$optionsButton.on('click', async () => {
            await browser.runtime.openOptionsPage();
            window.close();
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
            if (config.pattern.trim() === url.trim() && config.isRegex === false) {
                alreadyExists = true;
                break;
            }
        }

        if (!alreadyExists) {
            let newConfig = new UrlPattern(url, false, MatchBy.Url);
            newConfig.lastHits.push(fullUrl);
            newConfig.hitCount = 1;
            newConfig.lastHitOn = new Date();

            configs.push(newConfig);
            await storageApi.saveSettings(configs, true);
            let tabs = await browser.tabs.query({ windowType: 'normal' });
            if (tabs.length === 1) {
                //If this is the only tab, lets not close the tab in order to prevent an infinite loop which can happen in rare cases
                await browser.tabs.update(tabId, { url: "about:blank" })
            } else {
                await browser.tabs.remove(tabId);
            }
        } else {
            alert("Url already exists");
        }
    }
}

(function () {
    new PopupJS().init();
})()