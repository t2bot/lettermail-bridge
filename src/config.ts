import * as config from "config";

interface IConfig {
    earthClassMail: {
        apiUrl: string;
        username: string;
        password: string;
        inboxId: number;
    };
}

const defaultConfig: IConfig = {
    earthClassMail: {
        apiUrl: "https://api.earthclassmail.com",
        username: "email@example.org",
        password: "unknown",
        inboxId: 0,
    },
};

const finalConfig = <IConfig>Object.assign({}, defaultConfig, config);
export default finalConfig;
