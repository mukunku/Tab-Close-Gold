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
			name: "URL Search Pattern (No wild cards, sorry)",
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
	
	var options = {
		enableCellNavigation: true,
		enableColumnReorder: false,
		editable: true,
		enableAddRow: true,
		forceFitColumns: true,
		autoEdit: false
	};
	
	var rows = [];
	var slickgrid = {};
	chrome.storage.sync.get({
		'config': [{
			enabled: true,
			pattern: "ducksarethebest.com",
			isRegex: false,
			hitCount: 0,
			lastHit: ''
		}],
		isCompressed: false
	}, function(item) {
		if (!chrome.runtime.lastError) {
			var isCompressed = false;
			if (item && item.isCompressed)
				isCompressed = true;
			
			if (item && item.config) {
				if (isCompressed) {
					rows = JSON.parse(LZString.decompressFromUTF16(item.config));
				} else {
					rows = item.config;
				}
			}

			if (!rows)
				rows = [];
			loadGrid("#body", rows, columns, options);
		} else {
			console.log(chrome.runtime.error);
		}
	});
	
	function loadGrid(selector, rows, columns, options) {
		slickgrid = new Slick.Grid("#body", rows, columns, options);
	
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
					$('#saveConfig').prop('disabled', false);
				} else if (args.grid.getColumns()[args.cell].id === "resethits") {
					args.grid.getData()[args.row].hitCount = 0;
					args.grid.getData()[args.row].lastHit = '';
					slickgrid.invalidateAllRows();
					slickgrid.render();
					$('#saveConfig').prop('disabled', false);
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
			
			$('#saveConfig').prop('disabled', false);
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
			
			$('#saveConfig').prop('disabled', false);
		});
	}
	
	$('#saveConfig').click(function() {
		chrome.storage.sync.set( {'config': LZString.compressToUTF16(JSON.stringify(slickgrid.getData())), 'isCompressed': true}, function() {
			if (chrome.runtime.lastError) {			
				console.log(chrome.runtime.error);
				alert("Could not save configuration!");
			} else {
				$('#saveConfig').prop('disabled', true);
			}
		});
	});
	
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
				
				$('#saveConfig').prop('disabled', false);
			} else {
				alert('Config was not in the correct format. Import failed!');
			}
		}
		catch(err) {
			alert('Config was not in the correct format. Import failed!');
		}
	});
});

