$(function() {
	var columns = [
		{
			name: "Enabled",
			field: "enabled",
			id: "enabled",
			sortable: true,
			resizable: false,
			cannotTriggerInsert: true,
			formatter: Slick.Formatters.Checkmark, 
			editor: Slick.Editors.Checkbox,
			cssClass: "centerText"
		}, 
		{
			name: "URL Search Pattern",
			field: "pattern",
			id: "pattern",
			sortable: true,
			resizable: true,
			cannotTriggerInsert: false,
			editor: Slick.Editors.LongText
		}, 
		{
			name: "Is RegEx?",
			field: "isRegex",
			id: "isRegex",
			sortable: true,
			resizable: false,
			cannotTriggerInsert: true,
			formatter: Slick.Formatters.Checkmark, 
			editor: Slick.Editors.Checkbox,
			cssClass: "centerText"
		},
		{
			name: "Hit Count",
			field: "hitCount",
			id: "hitCount",
			sortable: true,
			resizable: false,
			cannotTriggerInsert: true,
			cssClass: "centerText",
			focusable: false
		},
		{
			name: "Last Hit",
			field: "hitHistory",
			id: "hitHistory",
			sortable: false,
			resizable: false,
			formatter: function(r, c, v, cd, dc) {
				return "Last Hit";
			},
			cannotTriggerInsert: true,
			focusable: false,
			cssClass: "centerText pointer underline"
		},
		{
			name: "Delete",
			field: "delete",
			id: "delete",
			sortable: false,
			resizable: false,
			formatter: function(r, c, v, cd, dc) {
				return "delete";
			},
			cannotTriggerInsert: true,
			focusable: false,
			cssClass: "centerText pointer underline"
		},
		{
			name: "Reset Hits",
			field: "resethits",
			id: "resethits",
			sortable: false,
			resizable: false,
			formatter: function(r, c, v, cd, dc) {
				return "reset hits";
			},
			cannotTriggerInsert: true,
			focusable: false,
			cssClass: "centerText pointer underline"
		}
	];
	
	var MAX_PARTITION_COUNT = chrome.storage.sync.MAX_ITEMS - 10; //-10 is to reserve some item capacity for settings.
	
	var options = {
		enableCellNavigation: true,
		enableColumnReorder: false,
		editable: true,
		enableAddRow: true,
		forceFitColumns: true,
		autoEdit: false
	};
	
	//Check where data is stored and load it
	var rows = [];
	var slickgrid = {};
	chrome.storage.sync.get({
		'useCloudStorage': true //All users will be using cloud storage by default
	}, function(item) {
		if (!chrome.runtime.lastError) {
			var useCloudStorage = !!(item && item.useCloudStorage);
			$('#storage-radiobutton').prop('checked', useCloudStorage).checkToggler({
			  labelOn: "Cloud",
			  labelOff: "Local"
			});
			updateStorageUsageProgressBar();
			
			var callback = function(item) {
				if (!chrome.runtime.lastError) {					
					//check if the data is partitioned (for cloud storage)
					var isPartitionedData = !!(item['config-2']);
					
					if (isPartitionedData) {
						var isDone = false;
						var i = 1;
						rows = [];
						while(!isDone) {
							var partition = item['config-' + i.toString()];
							i++;
							if (partition) {
								rows = rows.concat(JSON.parse(LZString.decompressFromUTF16(partition)));
							} else {
								isDone = true;
							}
						}
					} else if (item['config-1'] || item['config']) { //TODO: Remove old 'config' key after some time
						//Single row of data detected (Usually means we're using Local storage)
						rows = JSON.parse(LZString.decompressFromUTF16(item['config-1'] || item['config']));
					} else {
						//no items exist. use default demo data
						rows = [{
							enabled: true,
							pattern: "findtheinvisiblecow.com",
							isRegex: false,
							hitCount: 0,
							lastHit: ''
						}]
					}
					
					populateGrid("#body", rows || [], columns, options);
				} else {
					console.log(chrome.runtime.error);
				}
			}
			
			if (useCloudStorage)
				chrome.storage.sync.get(null, callback);
			else 
				chrome.storage.local.get(null, callback);
			
		} else {
			console.log(chrome.runtime.error);
		}
	});
		
	function populateGrid(selector, rows, columns, gridOptions) {
		slickgrid = new Slick.Grid("#body", rows, columns, gridOptions);
	
		slickgrid.onClick.subscribe(function(e, args){
			try
			{
				if (args.grid.getColumns()[args.cell].id === "hitHistory") {
					if (args.grid.getData()[args.row].lastHit) 
						alert(args.grid.getData()[args.row].lastHit);
					else
						alert("Not hit yet!");
				} else if (args.grid.getColumns()[args.cell].id === "delete") {
					args.grid.getData().splice(args.row, 1);
					slickgrid.invalidateAllRows();
					slickgrid.render();
					$('#saveConfig').prop('disabled', false).css('background-color', '#1FFF45');
				} else if (args.grid.getColumns()[args.cell].id === "resethits") {
					args.grid.getData()[args.row].hitCount = 0;
					args.grid.getData()[args.row].lastHit = '';
					slickgrid.invalidateAllRows();
					slickgrid.render();
					$('#saveConfig').prop('disabled', false).css('background-color', '#1FFF45');
				}
			}
			catch (err) {
				console.log(err.message);
			}
		});
		
		slickgrid.onSort.subscribe(function (e, args) {
		  var col = args.sortCol;
		  rows.sort(function (dataRow1, dataRow2) {
			  var field = col.field;
			  var sign = args.sortAsc ? 1 : -1;
			  var value1 = dataRow1[field], value2 = dataRow2[field];
			  var result = (value1 == value2 ? 0 : (value1 > value2 ? 1 : -1)) * sign;
			  if (result != 0) {
				return result;
			  }
			return 0;
		  });
		  slickgrid.invalidate();
		  slickgrid.render();
		});
		
		slickgrid.onAddNewRow.subscribe(function (e, args) {
			var newRow = args.item;
			newRow.enabled = true;
			newRow.isRegex = false;
			newRow.hitCount = 0;
			newRow.lastHit = "";
			
			args.grid.getData().splice(args.grid.getDataLength(), 1, newRow);
			args.grid.invalidateRow(args.grid.getDataLength() - 1);
			args.grid.updateRowCount();
			args.grid.render();
			
			$('#saveConfig').prop('disabled', false).css('background-color', '#1FFF45');
		});
		
		slickgrid.onCellChange.subscribe(function (e, args) {
			if (args.item.pattern && args.item.isRegex) {
				try {
					new RegExp(args.item.pattern);
				} catch(e) {
					alert("Your pattern is not a valid regex!");
				}
			}
			
			if (args.item.pattern)
				args.item.pattern = args.item.pattern.trim();
			
			$('#saveConfig').prop('disabled', false).css('background-color', '#1FFF45');
		});
	}
	
	$('#saveConfig').click(function() {
		saveSettings();
	});
	
	function saveSettings(suppressErrors, callback) {
		var useCloudStorage = $('#storage-radiobutton').prop('checked');		
		var saveFinishedCallback = function() {
			updateStorageUsageProgressBar(); //no harm in updating regardless of success
			if (chrome.runtime.lastError) {			
				if (!suppressErrors) {
					console.log(chrome.runtime.lastError.message);
					if (chrome.runtime.lastError.message === "QUOTA_BYTES quota exceeded") {
						alert("Not enough storage available. Please consider reducing number of url's.");
					} else {
						alert("Could not save configuration!");
					}
				}
				
				if (typeof callback === 'function') {
					callback(false);
				}
			} else {
				//We always store the 'useCloudStorage' flag in the cloud storage
				chrome.storage.sync.set({ 'useCloudStorage': useCloudStorage }, function() {
					if (chrome.runtime.lastError) {
						if (!suppressErrors) {
							console.log(chrome.runtime.lastError.message);
							alert("Could not save configuration!");
						}
						
						if (typeof callback === 'function') {
							callback(false);
						}
					} else {
						$('#saveConfig').prop('disabled', true).css('background-color', '');
						if (typeof callback === 'function') {
							callback(true);
						}
					}
				});
			}
		}
		
		if (useCloudStorage) {
			//Cloud storage has strict limits on storage per config item. so we must partition our data.
			var options = generatePartitionedOptionsForCloudStorage();
			chrome.storage.sync.set(options, saveFinishedCallback);
			console.log("Saved to cloud storage");
			
			chrome.storage.sync.remove('isCompressed'); //remove deprecated config
			//chrome.storage.sync.remove('config'); Lets not remove just yet in case something goes wrong and I need to revert...
		}
		else {
			//No 'per-item' storage limitations in local storage so we can just dump it all into one item
			var options = {'config-1': LZString.compressToUTF16(JSON.stringify(slickgrid.getData()))};
			chrome.storage.local.set(options, saveFinishedCallback);
			console.log("Saved to local storage");
			
			chrome.storage.sync.remove('isCompressed'); //remove deprecated config
			//chrome.storage.local.remove('config'); Lets not remove just yet in case something goes wrong and I need to revert...
		}
	}
	
	$('#exportConfig').click(function() {
		var output = [];
		
		if (rows && rows.length && rows.length > 0) {
			output = new Array(rows.length);
			
			for (var i=0; i < rows.length; i++) {
				if (rows[i] && rows[i].pattern && rows[i].pattern.trim()) {
					var config = {};
					config.pattern = rows[i].pattern.trim();
					config.enabled = rows[i].enabled;
					config.isRegex = rows[i].isRegex;
					
					output[i] = config;
				}
			}
		}
		
		$('#configTextArea').val(JSON.stringify(output));
	});
	
	$('#importConfig').click(function() {
		try
		{
			if (!slickgrid || !slickgrid.render)
				return;
		
			var importConfig = JSON.parse($('#configTextArea').val());
			
			if (importConfig && importConfig.length && importConfig.length > 0) {
				for(var i = 0; i < importConfig.length; i++) {
					var config = importConfig[i];
					
					if (config) {
						if (!config.pattern || !config.pattern.trim()) {
							alert("Cannot import config due to the pattern missing for one of the configurations");
							break;
						} else {
							config.pattern = config.pattern.trim();
						}
						
						if (!config.enabled)
							config.enabled = false;
						
						if (!config.isRegex)
							config.isRegex = false;
						
						config.hitCount = 0;
						config.lastHit = "";
					}
				}
				
				rows = rows.concat(importConfig);
				slickgrid.setData(rows);
				slickgrid.invalidateAllRows();
				slickgrid.render();
				
				$('#saveConfig').prop('disabled', false).css('background-color', '#1FFF45');
			} else {
				alert('Config was not in the correct format. Import failed!');
			}
		}
		catch(err) {
			alert('Config was not in the correct format. Import failed!');
		}
	});
	
	$('#storage-radiobutton').change(function() {		
		var hasPendingChanges = !$('#saveConfig').prop('disabled');
		if (!hasPendingChanges) {
			var useCloudStorage = this.checked;
			
			saveSettings(true, function(isSuccess) {
				if (isSuccess) {					
					$('#storage-switch-message').text('Successfully switched to ' + (useCloudStorage ? 'Cloud' : 'Local') + ' storage.').css('color','green');
				} else if (useCloudStorage) {
					$('#storage-switch-message').text('Failed to switch to Cloud storage. You may have too many settings.').css('color','red');
				} else {
					$('#storage-switch-message').text('Failed to switch to Local storage. An unexpected error occurred.').css('color','red');
				}
			});
		} else {
			alert("Please save your changes before switching the storage location");
			this.checked = !this.checked; //revert the value
		}
	});
	
	function updateStorageUsageProgressBar() {
		var useCloudStorage = $('#storage-radiobutton').prop('checked');
		var storageObject = useCloudStorage ? chrome.storage.sync : chrome.storage.local;	
		storageObject.getBytesInUse(null, function(bytesUsed) { //null = get all usage
			var maxBytes = Math.min((storageObject.QUOTA_BYTES_PER_ITEM * MAX_PARTITION_COUNT || storageObject.QUOTA_BYTES), storageObject.QUOTA_BYTES);
			var percentage = (100 * bytesUsed / maxBytes);
			var percentageText = (percentage < 0.01 ? 0.01 : percentage).toFixed(2) + '%';
			$('#storage-usage-progress-bar').prop('max', maxBytes).prop('value', bytesUsed).text(percentageText);
			$('#storage-usage-percentage-text').text(percentageText);
		}); 
	}
	
	function generatePartitionedOptionsForCloudStorage() {
		function splitArrayIntoChunksOfLen(arr, len) {
			var chunks = [], i = 0, n = arr.length;
			while (i < n) {
				chunks.push(arr.slice(i, i += len));
			}
			return chunks;
		};
			
		//We split our data into multiple arrays so we can maximize our usage of the cloud storage.		
		var data = slickgrid.getData();
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
	
	$('#delete-all-button').click(function() {
		var promptText = prompt("Warning: all saved settings will be deleted. Type 'delete all' below to confirm deletion:") || '';
		if (promptText.toLowerCase().replaceAll("'", "") === "delete all") {
			var useCloudStorage = $('#storage-radiobutton').prop('checked');
			var callback = function() {
				if (!chrome.runtime.lastError) {
					alert("All options cleared");
				} else {
					alert("Something went wrong. Please try again.");
				}
				location.reload(true);
			}
			
			if (useCloudStorage) {
				chrome.storage.sync.clear(callback);
			} else {
				chrome.storage.local.clear(callback);
			}
		}
	});
});