import { Environment } from "./helpers/env";
import { StorageApiFactory } from "./storage/storage-api-factory";
import { MatchBy, UrlPattern } from "./storage/url-pattern";
import * as browser from "webextension-polyfill";
import { LocalStorageApi } from "./storage/storage-api.local";
import { setIconEnabled, setIconDisabled, EXTENSION_PAUSED_UNTIL_KEY } from "./helpers/utilities";

export class PopupJS {
    private static readonly DEFAULT_PAUSE_DURATION_MINUTES = 5;
    private readonly localStorageApi: LocalStorageApi;

    private $blacklistButton = $('#blacklist');
    private $optionsButton = $('#options');
    private $body = $('body');
    private $pauseButton = $('#pause');
    private $pausedIcon = $('#paused-icon');
    private $enabledIcon = $('#enabled-icon');

    private extensionPausedUntilTime: number | null = null;

    constructor() {
        this.localStorageApi = new LocalStorageApi();
    }

    public async init(): Promise<void> {
        this.$blacklistButton.on('click', async () => {
            let tabs = await browser.tabs.query({ active: true, currentWindow: true });
            if (tabs && tabs[0]) {
                let currentTab = tabs[0];

                if (Environment.isFirefox()) {
                    //HACK: the prompt doesn't fit into the popup in firefox so we need to resize the popup...
                    this.$body.height(this.$body.height()! + 100);
                    this.$body.width(this.$body.width()! + 240);
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

        this.$pauseButton.on('click', async () => {
            if (!this.isPaused()) {
                await this.pauseExtension();
            } else {
                await this.enableExtension();
            }
        });
        
        if (document.location.href.endsWith("paused")) {
            this.renderPause();
        }

        this.extensionPausedUntilTime = await this.localStorageApi.GetByKey(EXTENSION_PAUSED_UNTIL_KEY);
        this.renderPauseTimeLeft();

        //Configure a countdown to show pause duration
        setInterval(async () => {
            this.renderPauseTimeLeft();
        }, 999);
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

    private async enableExtension() {
        await this.localStorageApi.RemoveKey(EXTENSION_PAUSED_UNTIL_KEY);
        this.renderEnabled();

        setIconEnabled();
    }

    private renderEnabled() {
        this.extensionPausedUntilTime = null;

        const childElems = this.$pauseButton.children();
        this.$pauseButton.text("Enabled");

        this.$pausedIcon.hide();
        this.$enabledIcon.show();

        this.$pauseButton.append(childElems);
    }

    private async pauseExtension() {
        this.extensionPausedUntilTime = Date.now() + (PopupJS.DEFAULT_PAUSE_DURATION_MINUTES * 60 * 1000);
        this.renderPause(`0${PopupJS.DEFAULT_PAUSE_DURATION_MINUTES}:00`);

        //Set storage after rendering for responsiveness
        await this.localStorageApi.SetByKey(EXTENSION_PAUSED_UNTIL_KEY, this.extensionPausedUntilTime);

        setIconDisabled();
    }

    private renderPause(timeLeft: string | null = null) {
        const childElems = this.$pauseButton.children();

        if (timeLeft) {
            this.$pauseButton.text(`Paused for ${timeLeft}`);
        } else {
            this.$pauseButton.text(`Paused`);
        }

        this.$pausedIcon.show();
        this.$enabledIcon.hide();

        this.$pauseButton.append(childElems);
    }

    private renderPauseTimeLeft() {
        if (this.isPaused()) {
            let pauseTimeLeftMS = (this.extensionPausedUntilTime || Date.now()) - Date.now();

            let timeLeft = "00:00";
            if (pauseTimeLeftMS > 0) {
                const secondsLeft = Math.round(pauseTimeLeftMS / 1000);
                const minutesLeft = Math.floor(secondsLeft / 60);
                const secondsRemainder = Math.floor(secondsLeft % 60);

                const minutesLeftString = `${(minutesLeft.toString().length === 1 ? "0" : "")}${minutesLeft}`;
                const secondsRemainderString = `${(secondsRemainder.toString().length === 1 ? "0" : "")}${secondsRemainder}`;
                timeLeft = `${minutesLeftString}:${secondsRemainderString}`;
            }
            this.renderPause(timeLeft);
        } else {
            this.enableExtension();
        }
    }

    private isPaused(): boolean {
        return this.extensionPausedUntilTime != null 
            && !isNaN(this.extensionPausedUntilTime) 
            && (this.extensionPausedUntilTime - Date.now() > 0);
    }
}

(function () {
    new PopupJS().init();
})()