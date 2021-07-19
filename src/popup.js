(function() {
	var MAX_PARTITION_COUNT = chrome.storage.sync.MAX_ITEMS - 10; //-10 is to reserve some item capacity for settings.
	
	function domain_from_url(url) {
		var result
		var match
		if (match = url.match(/^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:\/\n\?\=]+)/im)) {
			result = match[1]
			if (match = result.match(/^[^\.]+\.(.+\..+)$/)) {
				result = match[1]
			}
		}
		return result
	}
	
	function generatePartitionedOptionsForCloudStorage(data) {
		function splitArrayIntoChunksOfLen(arr, len) {
			var chunks = [], i = 0, n = arr.length;
			while (i < n) {
				chunks.push(arr.slice(i, i += len));
			}
			return chunks;
		};
			
		//We split our data into multiple arrays so we can maximize our usage of the cloud storage.	
		var rowCountPerItem = Math.ceil(data.length / MAX_PARTITION_COUNT);
		var splitData = splitArrayIntoChunksOfLen(data, rowCountPerItem);
		
		var config = {};
		for (var i = 0; i < MAX_PARTITION_COUNT; i++) {
			if (i < splitData.length)
				config['config-' + (i + 1).toString()] = LZString.compressToUTF16(JSON.stringify(splitData[i]));
			else
				config['config-' + (i + 1).toString()] = null;
		}
		return config;
	}
	
	function saveNewUrlToStorage(url, tabId) {
		var useCloudStorage = true;
		var callback = function(item) {
			if (!chrome.runtime.lastError) {
				var configs = [];
				var isPartitionedData = !!(item['config-2']);
				if (isPartitionedData) { //partitioned data means cloud storage
					var isDone = false;
					var i = 1;
					while(!isDone) {
						var partition = item['config-' + i.toString()];
						i++;
						if (partition) {
							configs = configs.concat(JSON.parse(LZString.decompressFromUTF16(partition)));
						} else {
							isDone = true;
						}
					}
				} else if (item['config-1'] || item['config']) { //TODO: Remove old 'config' key after some time
					//Single row of data detected (Usually means we're using Local storage)
					configs = JSON.parse(LZString.decompressFromUTF16(item['config-1'] || item['config']));
				} else {
					//no items exist. use default demo data
					configs = [{
						enabled: true,
						pattern: "findtheinvisiblecow.com",
						isRegex: false,
						hitCount: 0,
						lastHit: ''
					}]
				}
				
				var alreadyExists = false;
				for (var i = 0; i < configs.length; i++) {
					var config = configs[i];
					if (config.pattern.trim() === url.trim()) {
						alreadyExists = true;
						break;
					}
				}
				
				if (!alreadyExists) {
					configs.push({
						enabled: true,
						pattern: url,
						isRegex: false,
						hitCount: 0,
						lastHit: ''
					});
					
					var closePopupCallback = function() {
						chrome.tabs.query({windowType:'normal'}, function(tabs) {
							if (tabs.length === 1) {
								//If this is the only tab, lets open a blank tab to prevent an infinite loop which can happen in rare cases
								chrome.tabs.create({ url: "about:blank" });
							}
							chrome.tabs.remove(tabId, function() {
								window.close();
							});
						});
					}
					
					if (useCloudStorage) {
						var options = generatePartitionedOptionsForCloudStorage(configs);
						chrome.storage.sync.set(options, closePopupCallback);
					} else {
						var options = {'config-1': LZString.compressToUTF16(JSON.stringify(configs))};
						chrome.storage.local.set(options, closePopupCallback);
					}
				} else {
					alert("Url already exists");
				}
			}
		};
	
		chrome.storage.sync.get({
			'useCloudStorage': true //All users will be using cloud storage by default
		}, function(item) {
			if (!chrome.runtime.lastError) {
				useCloudStorage = !!(item && item.useCloudStorage);
				
				if (useCloudStorage)
					chrome.storage.sync.get(null, callback);
				else 
					chrome.storage.local.get(null, callback);
			}
		});
	}
	
	$('#blacklist').click(function() {
		var queryOptions = { active: true, currentWindow: true };
		chrome.tabs.query(queryOptions, function(tabs) {
			if (tabs && tabs[0]) {
				var currentTab = tabs[0];
				
				if (currentTab.url.startsWith('chrome-extension') || currentTab.url.startsWith('chrome:')) {
					alert("Can't blacklist this page");
					window.close();
					return;
				}
				
				var keepRunning = true;
				while (keepRunning) {
					var url = prompt("Confirm blacklist url", domain_from_url(currentTab.url));
					if (url !== null) { //null => user hit cancel
						if (url.trim()) {
							if (url.length > 3) {
								saveNewUrlToStorage(url, currentTab.id);
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
	});
	
	$('#options').click(function() {
		chrome.runtime.openOptionsPage();
	});
})()