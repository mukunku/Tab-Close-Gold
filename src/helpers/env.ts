import * as browser from "webextension-polyfill";

export enum RuntimeEnvironment {
    Unknown,
    Development,
    Production
}

export class Environment {
    public static getEnvironment(): RuntimeEnvironment {
        const webpackEnvironment: string = process.env.NODE_ENV || "";
        if (webpackEnvironment === "development") {
            return RuntimeEnvironment.Development;
        } else if (webpackEnvironment === "production") {
            return RuntimeEnvironment.Production;
        } else {
            return RuntimeEnvironment.Unknown;
        }
    }

    public static isProd(): boolean {
        return Environment.getEnvironment() === RuntimeEnvironment.Production;
    }

    public static isDev(): boolean {
        return Environment.getEnvironment() === RuntimeEnvironment.Development;
    }

    public static isFirefox(): boolean {
        return !browser.storage.local.QUOTA_BYTES; //QUOTA_BYTES is not defined in FF
    }
}