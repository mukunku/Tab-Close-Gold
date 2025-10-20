export enum MatchBy {
    Url = 0,
    Title = 1,
    Url_or_Title = 2
}

export class UrlPattern {
    public static readonly LAST_HIT_HISTORY_COUNT: number = 5;
    public static readonly MAX_DELAY_IN_MILLISECONDS = 30000;
    public static readonly MAX_LAST_HIT_LENGTH = 197; //We limit the lengths to avoid storing overly long strings (E.g. 2k+ characters)


    public enabled: boolean;
    public pattern: string;
    public isRegex: boolean;
    public hitCount: number;
    public lastHits: string[];
    public lastHitOn: Date | null;
    public delayInMs: number;
    public matchBy: MatchBy;

    constructor(pattern: string, isRegex: boolean, matchBy: MatchBy) {
        this.enabled = true;
        this.pattern = pattern;
        this.isRegex = isRegex;
        this.hitCount = 0;
        this.lastHits = [];
        this.lastHitOn = null;
        this.delayInMs = 0;
        this.matchBy = matchBy;
    }

    public static readonly DEFAULT_SETTINGS: UrlPattern[] = 
    [{
        enabled: true,
        pattern: "findtheinvisiblecow.com",
        isRegex: false,
        hitCount: 0,
        lastHits: [],
        lastHitOn: null,
        delayInMs: 0,
        matchBy: MatchBy.Url
    },{
        enabled: false,
        pattern: "zoom.us/j/*",
        isRegex: false,
        hitCount: 0,
        lastHits: [],
        lastHitOn: null,
        delayInMs: 5000,
        matchBy: MatchBy.Url
    }]; 
    
    public static isSystemTab(url: string | null | undefined, title: string | null | undefined): boolean {
        if (!url && !title) {
            return false;
        }
        
        return !!(url && (
                url.startsWith('chrome-extension:') || 
                url.startsWith('chrome:') || 
                url.startsWith('about:') || 
                url.startsWith('moz-extension:')
            ) || (title && (
                title === 'Tab Close Gold - Options' || 
                title === 'New Tab' || 
                title.startsWith('chrome://') ||
                title.startsWith('about://') || 
                title.startsWith('moz-extension:') || 
                title === 'Settings' ||
                title === 'Extensions' ||
                title === 'Add-ons Manager' || 
                title === 'Extensions - Tab Close Gold' ||
                title.endsWith('/options.html')
            )));
    }
}

