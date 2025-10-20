import * as browser from "webextension-polyfill";

export const EXTENSION_PAUSED_UNTIL_KEY = "extension-paused-until";

export function setIconEnabled() {
    browser.action.setIcon({ path: "./icon128.png" } as browser.Action.SetIconDetailsType);
    browser.action.setPopup({ popup: "./popup.html" } as browser.Action.SetPopupDetailsType);
}

export function setIconDisabled() {
    browser.action.setIcon({ path: "./icon128-disabled.png" } as browser.Action.SetIconDetailsType);
    browser.action.setPopup({ popup: "./popup.html?paused" } as browser.Action.SetPopupDetailsType);
}