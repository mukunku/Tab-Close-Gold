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
}