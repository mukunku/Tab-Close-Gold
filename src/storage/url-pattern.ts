
export class UrlPattern {
    public static readonly LAST_HIT_HISTORY_COUNT: number = 5;
    public static readonly MAX_DELAY_IN_MILLISECONDS = 10000;

    public enabled: boolean;
    public pattern: string;
    public isRegex: boolean;
    public hitCount: number;
    public lastHit: string | null;
    public lastHits: string[]; //replaces 'lastHit' (TODO: Remove 'lastHit' after some time)
    public lastHitOn: Date | null;
    public delayInMs: number;

    constructor(pattern: string, isRegex: boolean) {
        this.enabled = true;
        this.pattern = pattern;
        this.isRegex = isRegex;
        this.hitCount = 0;
        this.lastHit = '';
        this.lastHits = [];
        this.lastHitOn = null;
        this.delayInMs = 0;
    }

    public static readonly DEFAULT_SETTINGS: UrlPattern[] = 
    [{
        enabled: true,
        pattern: "findtheinvisiblecow.com",
        isRegex: false,
        hitCount: 0,
        lastHit: '',
        lastHits: [],
        lastHitOn: null,
        delayInMs: 0
    }];   
}