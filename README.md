## Tab-Close-Gold
Firefox & Chrome extension to auto close tabs. Formerly known as "Ad Close Gold"

![options page](./images/main-screenshot.png) 

Close tabs by configuring search patterns that match website url's or titles. Search patterns can be strings with wildcards or regular expressions. 

Keeps track of tabs it closes and supports exporting and importing configurations.

The extension will sync your configs across browsers if you are using the synchronization functionality of your browser.

## Download 

![chrome browser icon](./images/chrome-icon_24x24.png) [Chrome extension](https://chromewebstore.google.com/detail/tab-close-gold/blhbohajaekmpblcffpkpogkhkmmbbhf)


![firefox browser icon](./images/firefox-icon_24x24.png) [Firefox extension](https://addons.mozilla.org/en-US/firefox/addon/tab-close-gold/)

## How to build locally

Follow these steps to get the extension working locally.

#### Testing in Chrome
1. Clone the repo and open a command prompt to the `src` folder
2. Run `npm install`
3. Once that completes run `npm run build:watch`
    * This way any time you make a change the app will re-transpile everything automatically
4. In Chrome go to `chrome://extensions/` and enable developer mode in the top-right corner
5. Click `Load unpacked` and select the `src` folder
6. Chrome will now have your local version of the extension running
7. As you make code changes you can click `Update` to update the extension in Chrome.

#### Testing in Firefox
1. Clone the repo and open a command prompt to the `src` folder
2. Run `npm install`
3. Once that completes run `npm run publish-debug`
    * This will generate `/src/publish.firefox.zip`
4. In Firefox go to `about:addons` 
5. Click on the gear icon and select `Debug Add-ons`
5. Next click `Load Temporary Add-on...` and select `publish.firefox.zip`
6. Firefox will now have your local version of the extension running
7. To push further code changes to Firefox you'll need to redo these steps each time


