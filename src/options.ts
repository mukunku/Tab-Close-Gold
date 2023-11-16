import { StorageApi } from "./storage/storage-api";
import { ChromeStorageType } from "./storage/chrome-storage-types";
import { StorageApiFactory } from "./storage/storage-api-factory";
import { MatchBy, UrlPattern } from "./storage/url-pattern";
import 'slickgrid';

//Following dependencies are needed for Slickgrid to work (webpack will bundle all them into 'options.bundle.js')
import './node_modules/slickgrid/lib/jquery-ui.min'; //this will cause an auto import of the latest jquery somehow..
import './node_modules/slickgrid/lib/jquery.event.drag-2.3.0';
import './node_modules/slickgrid/lib/jquery.event.drop-2.3.0';
import './node_modules/slickgrid/slick.formatters';
import './node_modules/slickgrid/slick.editors';
import './node_modules/slickgrid/slick.grid';
import { LogLevel, LogRecord, Logger } from "./helpers/logger";
import { ModalWindow } from "./helpers/modal-window";
import { Environment, RuntimeEnvironment } from "./helpers/env";
import { SessionStorageApi } from "./storage/storage-api.session";
import { CheckboxOption, ContextMenu, DropdownOption, LinkButton } from "./helpers/context-menu";

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
            cssClass: "center-text",
            width: 60
        },
        {
            name: "Search Pattern",
            field: "pattern",
            id: "pattern",
            sortable: true,
            resizable: true,
            cannotTriggerInsert: false,
            editor: Slick.Editors.Text,
            formatter: (row: any, cell: any, value: any, columndef: any, datacontext: any) => {
                const urlPattern = datacontext as UrlPattern;
                if (urlPattern.isRegex) {
                    return `<span>${value}<img title="Regex" class="float-right" src="./images/regex_12x12.png"
                        style="padding: 3px; opacity: 70%;"></span>`;
                } else {
                    return `<span>${value}</span>`;
                }
            }
        },
        {
            name: "Delay",
            field: "delayInMs",
            id: "delayInMs",
            sortable: false,
            resizable: false,
            formatter: (row: any, cell: any, value: any, columndef: any, datacontext: any) => {
                if (!value || value <= 0) {
                    return '<img style="cursor: pointer;" src="./images/stopwatch-inactive.png">';
                } else {
                    return '<img style="cursor: pointer;" src="./images/stopwatch-active.png">';
                }
            },
            cannotTriggerInsert: true,
            focusable: false,
            cssClass: "center-text",
            width: 60
        },
        {
            name: "Hit Count",
            field: "hitCount",
            id: "hitCount",
            sortable: true,
            resizable: false,
            cannotTriggerInsert: true,
            cssClass: "center-text",
            focusable: false,
            width: 60
        },
        {
            name: "Last Hits",
            field: "hitHistory",
            id: "hitHistory",
            sortable: false,
            resizable: false,
            formatter: function () {
                return "last hits";
            },
            cannotTriggerInsert: true,
            focusable: false,
            cssClass: "center-text pointer underline",
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
            cssClass: "center-text",
            width: 130
        },
        {
            name: "Delete",
            field: "delete",
            id: "delete",
            sortable: false,
            resizable: false,
            formatter: function () {
                return "delete";
            },
            cannotTriggerInsert: true,
            focusable: false,
            cssClass: "center-text pointer underline",
            width: 60
        },
        {
            name: "Settings",
            field: "settings",
            id: "settings",
            sortable: false,
            resizable: false,
            formatter: (row: any, cell: any, value: any, columndef: any, datacontext: any) => {
                return '<img style="cursor: pointer;" src="./images/gear-icon.png">';
            },
            cannotTriggerInsert: true,
            focusable: false,
            cssClass: "center-text",
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
    private readonly $exportConfigButton = $('#exportConfig');
    private readonly $importConfigButton = $('#importConfig');
    private readonly $configTextArea = $('#configTextArea');
    private readonly $deleteAllButton = $('#delete-all-button');
    private readonly $showLogsButton = $('#show-logs-button');
    private slickgrid: Slick.Grid<UrlPattern> | null = null;

    public async init(): Promise<void> {
        //Update storage dropdown
        let storageType = await StorageApi.getUserStorageType();
        let storageTypeString: string = ChromeStorageType[storageType];
        this.$storageDropdown.val(storageTypeString);

        //Update storage usage
        await this.updateStorageUsageProgressBar(storageType);

        //Populate the slickgrid
        let urlPatterns: UrlPattern[] = await (await StorageApiFactory.getStorageApi()).getSettings();

        //sort by Last Hit On desc
        urlPatterns = urlPatterns.sort((pattern1, pattern2) => {
            const lastHit1 = pattern1.lastHitOn || '1970-01-01T00:00:00.000Z';
            const lastHit2 = pattern2.lastHitOn || '1970-01-01T00:00:00.000Z';

            //For some reason 'lastHitOn' is string in our storage. TODO: Need to investigate but seems to be working
            let result = lastHit2.toString().localeCompare(lastHit1.toString() || '') //lastHitOn desc
            return result!;
        });

        this.populateGrid("#body", urlPatterns, OptionsJS.columns, OptionsJS.options);

        //Tell slick grid the data is sorted (doesn't actually trigger sort)
        this.slickgrid?.setSortColumns([
            { columnId: 'lastHitOn', sortAsc: false }
        ]); //show last hit first

        this.attachEvents();
    }

    private attachEvents(): void {
        this.$storageDropdown.on('change', async () => {
            let selectedValue = <string>this.$storageDropdown.val();
            let selectedStorageType = ChromeStorageType[selectedValue as keyof typeof ChromeStorageType];
            let currentStorageApi = await StorageApiFactory.getStorageApi();
            let desiredStorageApi = await StorageApiFactory.getStorageApi(selectedStorageType);

            if (currentStorageApi.storageType === desiredStorageApi.storageType) {
                return;
            }

            await currentStorageApi.changeUserStorageType(desiredStorageApi);
            this.updateStorageUsageProgressBar(selectedStorageType);
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
            try {
                if (!this.slickgrid || !this.slickgrid.render)
                    return; //Is this check still needed?

                var jsonToImport = <string>this.$configTextArea.val();
                if (!jsonToImport)
                    return;

                var importConfig: UrlPattern[] = JSON.parse(jsonToImport);
                let existingConfig: UrlPattern[] = this.slickgrid.getData();
                let importedCount = 0;
                for (var i = 0; i < importConfig.length; i++) {
                    var config = importConfig[i];

                    if (config && config.pattern && config.pattern.trim()) {
                        let urlPattern = new UrlPattern(config.pattern.trim(), !!config.isRegex, config.matchBy);
                        urlPattern.enabled = !!config.enabled;
                        urlPattern.delayInMs
                            = Math.min(UrlPattern.MAX_DELAY_IN_MILLISECONDS, config.delayInMs) || 0;

                        //TODO: fix this n^2 time complexity
                        if (existingConfig.filter(ec => ec.pattern === urlPattern.pattern
                            && ec.isRegex === urlPattern.isRegex).length === 0) {
                            //only add the pattern if it doesn't already exist
                            existingConfig.push(urlPattern);
                            importedCount++;
                        }
                    }
                }

                this.slickgrid.setData(existingConfig, false);
                this.slickgrid.invalidateAllRows();
                this.slickgrid.render();

                if (importedCount > 0) {
                    await this.saveSettings();
                }

                if (importedCount == 1) {
                    alert(`1 new record imported`);
                } else {
                    alert(`${importedCount} new records imported`);
                }
            }
            catch (error: any) {
                const errorMessage = `Config was not in the correct format. Import failed!
${error.message}`;
                console.error(errorMessage);
                alert(errorMessage);
            }
        });

        this.$deleteAllButton.on('click', async () => {
            try {
                var promptText = prompt("Warning: all saved settings will be deleted. Type 'delete all' below to confirm deletion:") || '';
                if (promptText.toLowerCase().replaceAll("'", "") === "delete all") {
                    let storageApi = await StorageApiFactory.getStorageApi();

                    //This will essentially factory reset the extension, not just remove the urls but that's okay.
                    storageApi.clearAllSettings();

                    //TODO: Logger is not thread-safe. So we can only have one writer in the entire application
                    alert("All options cleared");
                    location.reload();
                }
            } catch (error: any) {
                const errorMessage = `Something went wrong:
${error.message}`;
                console.error(errorMessage);
                alert(errorMessage);
            }
        });

        //make slickgrid checkboxes more responsive
        $('#body').on('blur', 'input.editor-checkbox', function () {
            Slick.GlobalEditorLock.commitCurrentEdit();
        });

        this.$showLogsButton.on('click', async (event) => {
            let modal: ModalWindow | null = null;

            function renderLogs(iterator: Generator<LogRecord>, take: number, minLogLevel: LogLevel): boolean {
                if (isNaN(take) || take <= 0) {
                    throw new Error(`'take' must be a positive number`);
                }

                let logRecords: LogRecord[] = [];
                let iteration: IteratorResult<LogRecord, any> | null = null;
                while (take > 0 && (iteration = iterator.next()) && !iteration.done) {
                    let logRecord = LogRecord.instantiate(iteration.value);

                    if (logRecord.type < minLogLevel) {
                        continue;
                    }

                    logRecords.push(logRecord);
                    take--;
                }

                //Data isn't exactly chronologically sorted due to race conditions. So we sort it here.
                logRecords = logRecords.sort( //desc
                    (a: LogRecord, b: LogRecord) => a.date === b.date ? 0 : (a.date > b.date ? -1 : 1)
                );

                const html = logRecords.map((logRecord: LogRecord) => logRecord.renderHtml()).join('');
                const recordCount = logRecords.length;
                const $bodyContent = $(`<div style="font-family: monospace; max-height: 60%; text-wrap: wrap; overflow: auto;">${html || '<p>No logs yet.</p>'}</div>`);
                const $headerContent = $(`<div style="display: flex; justify-content: space-between;">
                        <div style="width: 20%;">Showing ${recordCount} recent log${recordCount === 1 ? '' : 's'}</div>
                        <div style="width: 20%;">
                            <label for="log-level">Log Level:</label>
                            <select name="log-level" id="log-level">
                                ${(!Environment.isProd() ? '<option value="1">Trace</option>' : '')}
                                <option value="2">Debug</option>
                                <option value="4">Warning</option>
                                <option value="8">Error</option>
                            </select>
                        </div>
                    </div>`);

                $headerContent.find('#log-level').val(minLogLevel);

                if (!modal) {
                    modal = new ModalWindow('logs-modal', {
                        show: true,
                        mode: null, // Disable modal mode, allow click outside to close
                        headerContent: $headerContent,
                        htmlContent: $bodyContent
                    }); //just creating the object will display the modal
                } else {
                    modal.initialize($headerContent, $bodyContent);
                }

                $('#log-level').off('change').on('change', async (event: any) => {
                    let minLogLevel = parseInt(event.target.value) as LogLevel;
                    const sessionStorage = new SessionStorageApi();
                    await sessionStorage.SetByKey('MIN_LOG_LEVEL', minLogLevel);

                    //Start over by getting a new iterator
                    const newLogIterator = await Logger.getLogsIterator(false);
                    renderLogs(newLogIterator, take, minLogLevel);
                });

                const isEndOfLogs = !!iteration?.done;
                return isEndOfLogs;
            }

            try {
                const sessionStorage = new SessionStorageApi();
                const maxLogCount = Logger.KEEP_LAST_N_LOGS; //render all logs for now
                const logIterator = await Logger.getLogsIterator(false);

                let userSelectedMinLogLevel = await sessionStorage.GetByKey('MIN_LOG_LEVEL') as LogLevel;
                const minLogLevel = userSelectedMinLogLevel || LogLevel.Debug;
                renderLogs(logIterator, maxLogCount, minLogLevel);
            } catch (error: any) {
                const errorMessage = `Could not show logs.
${error.message}`;
                console.error(errorMessage);
                alert(errorMessage);
            }
        });
    }

    private async saveSettings(): Promise<void> {
        try {
            let storageApi = await StorageApiFactory.getStorageApi();
            let rawOptions = <UrlPattern[]>this.slickgrid?.getData();
            await storageApi.saveSettings(rawOptions, true);
        }
        catch (error: any) {
            const errorMessage = `Could not save configurations.
${error.message}`;
            console.error(errorMessage);
            alert(errorMessage);
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
        this.slickgrid.onClick.subscribe(async (event, args) => {
            try {
                const gridRow = args.grid.getData()[args.row] as UrlPattern;
                if (args.grid.getColumns()[args.cell].id === "hitHistory") {
                    let lastHits = gridRow.lastHits as string[];
                    let message = "Not hit yet!";
                    if (Array.isArray(lastHits) && lastHits.length > 0) {
                        let messageBuilder = [`Showing last ${UrlPattern.LAST_HIT_HISTORY_COUNT} hits (most recent first)`];
                        console.log(`Printing hits for pattern: ${gridRow.pattern}`);
                        let index = 1;
                        for (let i = lastHits.length - 1; i >= 0; i--) {
                            //Trim the url so it fits in the alert box
                            const maxUrlLength = 50;
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
                        await this.saveSettings();
                    }
                } else if (args.grid.getColumns()[args.cell].id === "delayInMs") {
                    let currentDelay = gridRow.delayInMs > 0 ? gridRow.delayInMs : 1000;
                    let delay = prompt(`Enter delay in milliseconds before tab should be closed (max ${UrlPattern.MAX_DELAY_IN_MILLISECONDS / 1000} seconds, 0 = disabled)`,
                        currentDelay.toString());
                    let delayInMs = Math.min(UrlPattern.MAX_DELAY_IN_MILLISECONDS, parseInt(delay));
                    if (delayInMs >= 0) {
                        gridRow.delayInMs = delayInMs;
                        await this.saveSettings();
                        this.slickgrid!.invalidateAllRows();
                        this.slickgrid!.render();
                    }
                } else if (args.grid.getColumns()[args.cell].id === "settings") {
                    const saveSettings = async () => { 
                        this.slickgrid!.invalidateAllRows();
                        this.slickgrid!.render();
                        await this.saveSettings();
                    };
                    
                    const isRegexCheckbox = new CheckboxOption("Is RegEx?", gridRow.isRegex, async (checked: boolean) => { 
                        gridRow.isRegex = checked;
                        await saveSettings();
                    });

                    let currentValue = "Url";
                    if (gridRow.matchBy === MatchBy.Url) {
                        currentValue = "Url";
                    } else if (gridRow.matchBy === MatchBy.Title) {
                        currentValue = "Title";
                    } else if (gridRow.matchBy === MatchBy.Url_or_Title) {
                        currentValue = "Url or Title";
                    }

                    const matchByDropdown = new DropdownOption("Match by: ", ["Url", "Title", "Url or Title"], currentValue, async (dropdown: string) => { 
                        if (dropdown === "Url") {
                            gridRow.matchBy = MatchBy.Url;
                        } else if (dropdown === "Title") {
                            gridRow.matchBy = MatchBy.Title;
                        } else if (dropdown === "Url or Title") {
                            gridRow.matchBy = MatchBy.Url_or_Title;
                        } else {
                            return;
                        }
                        await saveSettings();
                    });

                    const resetHitsButton = new LinkButton("Reset hits", async () => {
                        if (confirm("Are you sure you want to reset hits?")) {
                            gridRow.hitCount = 0;
                            gridRow.lastHits = [];
                            gridRow.lastHitOn = null;
                            await saveSettings();
                        }
                    });

                    const $clickedCell = $(args.grid.getCellNode(args.row, args.cell));
                    const menu = new ContextMenu([isRegexCheckbox, matchByDropdown, resetHitsButton]);
                    menu.render($clickedCell);
                    event.stopPropagation(); //don't trigger onclick handlers we attach in ContextMenu
                }
            }
            catch (error: any) {
                const errorMessage = `An error occurred while populating the grid:
${error.message}`;
                console.error(errorMessage);
                alert(errorMessage);
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

            await this.saveSettings();
        });

        this.slickgrid.onCellChange.subscribe(async (e, args) => {
            args.item.pattern = args.item.pattern && args.item.pattern.trim();
            if (args.item.pattern && args.item.isRegex) {
                try {
                    new RegExp(args.item.pattern);
                } catch (error) {
                    alert("Your pattern is not a valid regex!");
                    args.grid.flashCell(args.row,
                        args.grid.getColumns().findIndex(c => c.id === "pattern"),
                        200);
                    return;
                }
            } else if (!args.item.pattern) {
                alert("You cannot leave the Search Pattern empty.");
                args.grid.flashCell(args.row,
                    args.grid.getColumns().findIndex(c => c.id === "pattern"),
                    200);
                return;
            }
            await this.saveSettings();
        });
    }
}

//equivalent to $(document).ready(...)
$(function () {
    new OptionsJS().init();
});

