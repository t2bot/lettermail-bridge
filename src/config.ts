import * as config from "config";

interface IConfig {
    earthClassMail: {
        apiUrl: string;
        username: string;
        password: string;
        inboxId: number;
        protectedPieces: number[];
    };
    matrix: {
        defaultAvatar: string;
        defaultName: string;
        managementRoom: string;
        appservice: {
            hsToken: string;
            asToken: string;
            userPrefix: string;
            botLocalpart: string;
            domain: string;
            address: string;
            port: number;
            csUrl: string;
            dataPath: string;
            assetsPath: string;
            botName: string;
            botAvatar: string;
        };
    };
    lob: {
        apiKey: string;
        maxRooms: number;
        maxMessagesPerRoom: number;
    };
    database: {
        host: string;
        port: number;
        username: string;
        password: string;
        database: string;
        sslmode: string;
    };
}

const defaultConfig: IConfig = {
    earthClassMail: {
        apiUrl: "https://api.earthclassmail.com",
        username: "email@example.org",
        password: "unknown",
        inboxId: 0,
        protectedPieces: [],
    },
    lob: {
        apiKey: "not set",
        maxRooms: 7,
        maxMessagesPerRoom: 3,
    },
    matrix: {
        defaultAvatar: "mxc://t2bot.io/183b28d9d10511e3c8b937674168c1de604076c0",
        defaultName: "Letter",
        managementRoom: "!room:example.org",
        appservice: {
            hsToken: "generated",
            asToken: "generated",
            userPrefix: "postal_",
            botLocalpart: "postmaster",
            domain: "localhost",
            address: "0.0.0.0",
            port: 8080,
            csUrl: "https://localhost:8448",
            dataPath: "storage",
            assetsPath: "tmpl/assets",
            botName: "Postmaster",
            botAvatar: "mxc://t2bot.io/b741b75047dfbde0470a93566325de2e54b439e0",
        },
    },
    database: {
        host: "localhost",
        port: 5432,
        username: "lettermail",
        password: "lettermail",
        database: "lettermail",
        sslmode: "require",
    },
};

const finalConfig = <IConfig>Object.assign({}, defaultConfig, config);
export default finalConfig;
