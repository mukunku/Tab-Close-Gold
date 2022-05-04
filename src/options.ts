import { StorageApi } from "./storage/storage-api";
import { ChromeStorageType } from "./storage/chrome-storage-types";
import { StorageApiFactory } from "./storage/storage-api-factory";
import { UrlPattern } from "./storage/url-pattern";
import 'slickgrid';

//Following dependencies are needed for Slickgrid to work (webpack will bundle all them into 'options.bundle.js')
import './node_modules/slickgrid/lib/jquery-ui.min'; //this will cause an auto import of the latest jquery somehow..
import './node_modules/slickgrid/lib/jquery.event.drag-2.3.0';
import './node_modules/slickgrid/lib/jquery.event.drop-2.3.0';
import './node_modules/slickgrid/slick.formatters';
import './node_modules/slickgrid/slick.editors';
import './node_modules/slickgrid/slick.grid'; 

export class OptionsJS { 
    private static readonly columns = [
        {
            name: "Enabled",
            field: "enabled",
            id: "enabled",
            sortable: true,
            resizable: false,
            cannotTriggerInsert: true,
            formatter: Slick.Formatters.Checkmark, 
            editor: Slick.Editors.Checkbox,
            cssClass: "centerText",
            width: 60
        }, 
        {
            name: "URL Search Pattern",
            field: "pattern",
            id: "pattern",
            sortable: true,
            resizable: true,
            cannotTriggerInsert: false,
            editor: Slick.Editors.Text
        }, 
        {
            name: "Delay",
            field: "delayInMs",
            id: "delayInMs",
            sortable: false,
            resizable: false,
            formatter: (row: any, cell: any, value: any, columndef: any, datacontext: any) => {
                if (!value || value <= 0) {
                    return '<img src="./images/stopwatch-inactive.png">';
                } else {
                    return '<img src="./images/stopwatch-active.png">';
                }
            },
            cannotTriggerInsert: true,
            focusable: false,
            cssClass: "centerText pointer",
            width: 60
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
            cssClass: "centerText",
            width: 60
        },
        {
            name: "Hit Count",
            field: "hitCount",
            id: "hitCount",
            sortable: true,
            resizable: false,
            cannotTriggerInsert: true,
            cssClass: "centerText",
            focusable: false,
            width: 60
        },
        {
            name: "Last Hits",
            field: "hitHistory",
            id: "hitHistory",
            sortable: false,
            resizable: false,
            formatter: function() {
                return "last hits";
            },
            cannotTriggerInsert: true,
            focusable: false,
            cssClass: "centerText pointer underline",
            width: 60
        },
        {
			name: "Last Hit On",
            field: "lastHitOn",
            id: "lastHitOn",
            sortable: true,
            resizable: false,
            editor: Slick.Editors.Date,
            formatter: (row: any, cell: any, value: any, columndef: any, datacontext: any) => {
                if (!value) {
                    return "";
                } else {
                    try {
                        return new Date(value).toLocaleString();
                    } catch {
                        return value;
                    }
                }     
            },
            cannotTriggerInsert: true,
            focusable: false,
            cssClass: "centerText",
            width: 130
		},
        {
            name: "Delete",
            field: "delete",
            id: "delete",
            sortable: false,
            resizable: false,
            formatter: function() {
                return "delete";
            },
            cannotTriggerInsert: true,
            focusable: false,
            cssClass: "centerText pointer underline",
            width: 60
        },
        {
            name: "Reset Hits",
            field: "resethits",
            id: "resethits",
            sortable: false,
            resizable: false,
            formatter: function() {
                return "reset hits";
            },
            cannotTriggerInsert: true,
            focusable: false,
            cssClass: "centerText pointer underline",
            width: 60
        }
    ];

    private static readonly options = {
        enableCellNavigation: true,
        enableColumnReorder: false,
        editable: true,
        enableAddRow: true,
        forceFitColumns: true,
        autoEdit: true //requires double click to edit if false
    };

    private readonly $storageDropdown = $('#storage-dropdown');
    private readonly $saveConfigButton = $('#saveConfig');
    private readonly $exportConfigButton = $('#exportConfig');
    private readonly $importConfigButton = $('#importConfig');
    private readonly $configTextArea = $('#configTextArea');
    private readonly $deleteAllButton = $('#delete-all-button');
    private slickgrid: Slick.Grid<UrlPattern> | null = null;

    public async init(): Promise<void> {
        //Update storage dropdown
        let storageType = await StorageApi.getUserStorageType();
        let storageTypeString: string = ChromeStorageType[storageType];
        this.$storageDropdown.val(storageTypeString);

        //Update storage usage
        await this.updateStorageUsageProgressBar(storageType);

        //Populate the slickgrid
        let urlPatterns = await (await StorageApiFactory.getStorageApi()).getSettings();

        //sort by Last Hit On desc
        urlPatterns.sort((pattern1, pattern2) => { 
            if (!pattern1 || !pattern2) {
                return -1;
            }
            //For some reason 'lastHitOn' is string in our storage. TODO: Need to investigate but seems to be working
            let result = pattern2.lastHitOn?.toString().localeCompare(pattern1.lastHitOn?.toString() || '') //lastHitOn desc
            if (result === null || result === undefined || result === 0) {
                result = pattern2.hitCount - pattern1.hitCount;//hitCount desc
                if (result === null || result === undefined || result === 0) {
                    result = pattern1.pattern.localeCompare(pattern2.pattern); //pattern asc
                }
            }
            return result;
        });

        this.populateGrid("#body", urlPatterns, OptionsJS.columns, OptionsJS.options);

        //Tell slick grid the data is sorted (doesn't actually trigger sort)
        this.slickgrid?.setSortColumns([
            { columnId: 'lastHitOn', sortAsc: false}, 
            { columnId: 'hitCount', sortAsc: false },
            { columnId: 'pattern', sortAsc: true },
        ]); //show last hit first

        this.attachEvents();

        this.$configTextArea.val(''); //clear input on refresh (for firefox)
    }

    private attachEvents(): void {
        this.$storageDropdown.on('change', async () => {
            let selectedValue = <string>this.$storageDropdown.val();
            let selectedStorageType = ChromeStorageType[selectedValue as keyof typeof ChromeStorageType];
            let currentStorageApi = await StorageApiFactory.getStorageApi();
            await currentStorageApi.changeUserStorageType(selectedStorageType);
            this.updateStorageUsageProgressBar(selectedStorageType);
        });

        this.$saveConfigButton.on('click', () => {
            this.saveSettings(false);
        });

        this.$exportConfigButton.on('click', () => {
            let exportConfig = this.slickgrid?.getData();
            let output = new Array(exportConfig.length);
            for (var i = 0; i < exportConfig.length; i++) {
                output[i] = {
                    pattern: exportConfig[i].pattern,
                    enabled: exportConfig[i].enabled,
                    isRegex: exportConfig[i].isRegex
                };

                if (exportConfig[i].delayInMs > 0) {
                    output[i].delayInMs = exportConfig[i].delayInMs;
                }
			}
            this.$configTextArea.val(JSON.stringify(output));
        });
        
        this.$importConfigButton.on('click', async () => {
            try
            {
                if (!this.slickgrid || !this.slickgrid.render)
                    return; //Is this check still needed?
            
                var importConfig: UrlPattern[] = JSON.parse(<string>this.$configTextArea.val());
                let existingConfig: UrlPattern[] = this.slickgrid.getData();
                let wasAnyImported = false;
                for(var i = 0; i < importConfig.length; i++) {
					var config = importConfig[i];
					
                    if (config && config.pattern && config.pattern.trim()) {
                        let urlPattern = new UrlPattern(config.pattern.trim(), !!config.isRegex);
                        urlPattern.enabled = !!config.enabled;
                        urlPattern.delayInMs 
                            = Math.min(UrlPattern.MAX_DELAY_IN_MILLISECONDS, config.delayInMs) || 0;

                        //TODO: fix this n^2 time complexity
                        if (existingConfig.filter(ec => ec.pattern === urlPattern.pattern 
                            && ec.isRegex === urlPattern.isRegex).length === 0) {
                                //only add the pattern if it doesn't already exist
                                existingConfig.push(urlPattern);
                                wasAnyImported = true;
                        }
                    }
				}
                
                this.slickgrid.setData(existingConfig, false);
                this.slickgrid.invalidateAllRows();
                this.slickgrid.render();
                
                if (wasAnyImported)
                    await this.toggleSaveChangesButton(true);
            }
            catch(err) {
                alert('Config was not in the correct format. Import failed!');
            }
        });

        this.$deleteAllButton.on('click', async () => {
            try {
                var promptText = prompt("Warning: all saved settings will be deleted. Type 'delete all' below to confirm deletion:") || '';
                if (promptText.toLowerCase().replaceAll("'", "") === "delete all") {
                    let storageApi = await StorageApiFactory.getStorageApi();
                    //This will essentially factory reset the extension, not just remove the urls but that's okay.
                    storageApi.clearAllSettings();
                    alert("All options cleared");
                    location.reload();
                }
            }
            catch {
                alert("Something went wrong. Please try again.");
            }
        });

        //make slickgrid checkboxes more responsive
        $('#body').on('blur', 'input.editor-checkbox', function() {
            Slick.GlobalEditorLock.commitCurrentEdit();
        });
    }

    private async saveSettings(suppressErrors: boolean, callback?: Function): Promise<void> {
        try
        {   
            let storageApi = await StorageApiFactory.getStorageApi();
            let rawOptions = <UrlPattern[]>this.slickgrid?.getData();
            await storageApi.saveSettings(rawOptions);
            await this.toggleSaveChangesButton(false);
            if (typeof callback === 'function') {
                callback(true);
            }
        }
        catch(err: any)
        {
            if (!suppressErrors) {
                console.error(`Tab Close Gold - Error while saving changes: ${err.message}`);
                alert("Could not save configuration!");
            }
            if (typeof callback === 'function') {
                callback(false);
            }
        }
	}

    private async updateStorageUsageProgressBar(storageType?: ChromeStorageType): Promise<void> {
        let storageApi = await StorageApiFactory.getStorageApi(storageType);
        let storageUsage = await storageApi.getStorageUsage();
		var percentageText = storageUsage.percentage.toFixed(2) + '%';
        
        $('#storage-usage-progress-bar')
            .prop('max', storageUsage.maxBytes)
            .prop('value', storageUsage.bytesUsed)
            .text(percentageText);
        $('#storage-usage-percentage-text').text(percentageText);
	}

    private populateGrid(selector: string, rows: Array<any>, columns: Slick.Column<any>[], gridOptions: Slick.GridOptions<any>): void {
		this.slickgrid = new Slick.Grid(selector, rows, columns, gridOptions);
		this.slickgrid.onClick.subscribe(async (e, args) => {
			try
			{
				if (args.grid.getColumns()[args.cell].id === "hitHistory") {
                    let lastHits = args.grid.getData()[args.row].lastHits as string[];
                    let message = "Not hit yet!";
					if (Array.isArray(lastHits) && lastHits.length > 0) {
                        let messageBuilder = [`Showing last ${UrlPattern.LAST_HIT_HISTORY_COUNT} hits (most recent first)`];
                        console.log(`Printing hits for pattern: ${args.grid.getData()[args.row].pattern}`);
                        let index = 1;
						for (let i = lastHits.length - 1; i >= 0; i--) {
                            //Trim the url so it fits in the alery box
                            const maxUrlLength = 60;
                            let lastHitTrimmed = lastHits[i].length > maxUrlLength ? 
                                lastHits[i].substring(0, maxUrlLength - 3) + "..." 
                                : lastHits[i];
                            messageBuilder.push(`${index}. ${lastHitTrimmed}`);

                            //incase urls are really long, let users at least be able to check F12 console
                            console.log(`${index}. ${lastHits[i]}`); 
                            
                            index++;
                        }
                        messageBuilder.push(""); //empty line 
                        messageBuilder.push("Note: Check F12 console for full urls if trimmed");
                        message = messageBuilder.join("\r\n");
                    }
					alert(message);
				} else if (args.grid.getColumns()[args.cell].id === "delete") {
                    if (confirm("Are you sure you want to delete?")) {
                        args.grid.getData().splice(args.row, 1);
                        this.slickgrid!.invalidateAllRows();
                        this.slickgrid!.render();
                        await this.toggleSaveChangesButton(true);
                    }
				} else if (args.grid.getColumns()[args.cell].id === "resethits") {
                    if (confirm("Are you sure you want to reset hits?")) {
                        args.grid.getData()[args.row].hitCount = 0;
                        args.grid.getData()[args.row].lastHits = [];
                        args.grid.getData()[args.row].lastHitOn = null;
                        this.slickgrid!.invalidateAllRows();
                        this.slickgrid!.render();
                        await this.toggleSaveChangesButton(true);
                    }
				} else if (args.grid.getColumns()[args.cell].id === "delayInMs") {
                    let currentDelay = args.grid.getData()[args.row].delayInMs > 0 ? 
                        args.grid.getData()[args.row].delayInMs : 1000;
                    let delay = prompt(`Enter delay in milliseconds before tab should be closed (max ${UrlPattern.MAX_DELAY_IN_MILLISECONDS / 1000} seconds, 0 = disabled)`, 
                        currentDelay.toString());
                    let delayInMs = Math.min(UrlPattern.MAX_DELAY_IN_MILLISECONDS, parseInt(delay));
                    if (delayInMs >= 0) {
                        args.grid.getData()[args.row].delayInMs = delayInMs;
                        await this.toggleSaveChangesButton(true);
                        this.slickgrid!.invalidateAllRows();
                        this.slickgrid!.render();
                    }
                }
			} 
			catch (err: any) {
				console.log(err && err.message);
			}
		});
		
		this.slickgrid.onSort.subscribe((e, args) => {
            var col = args.sortCol;
            rows.sort(function (dataRow1, dataRow2) {
                var field = col!.field;
                var sign = args.sortAsc ? 1 : -1;
                var value1 = dataRow1[field!], value2 = dataRow2[field!];
                var result = (value1 == value2 ? 0 : (value1 > value2 ? 1 : -1)) * sign;
                if (result != 0) {
                  return result;
                }
                return 0;
            });
            this.slickgrid!.invalidate();
            this.slickgrid!.render();
		});
		
		this.slickgrid.onAddNewRow.subscribe(async (e, args) => {
			var newRow = args.item;
			newRow.enabled = true;
			newRow.isRegex = false;
			newRow.hitCount = 0;
			newRow.lastHits = [];
			
			args.grid.getData().splice(args.grid.getDataLength(), 1, newRow);
			args.grid.invalidateRow(args.grid.getDataLength() - 1);
			args.grid.updateRowCount();
			args.grid.render();
			
			await this.toggleSaveChangesButton(true);
		});
		
		this.slickgrid.onCellChange.subscribe(async (e, args) => {
			if (args.item.pattern && args.item.isRegex) {
				try {
					new RegExp(args.item.pattern);
				} catch(e) {
					alert("Your pattern is not a valid regex!");
				}
			}
			
			args.item.pattern = args.item.pattern && args.item.pattern.trim();
			
            await this.toggleSaveChangesButton(true);
		});
	}

    private async toggleSaveChangesButton(isEnabled: boolean): Promise<void> {
        if (isEnabled) {
            //this.$saveConfigButton.prop('disabled', false).css('background-color', '#1FFF45');
            //No more save changes button, lets just save instead! TODO: Remove the button html and these lines
            await this.saveSettings(false);
        } else {
            //this.$saveConfigButton.prop('disabled', true).css('background-color', '');
        }
    }
}

//equivalent to $(document).ready(...)
$(function() {
    new OptionsJS().init();
});

