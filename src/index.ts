import {
    Appservice,
    AutojoinRoomsMixin,
    IAppserviceOptions,
    IAppserviceRegistration,
    LogLevel,
    LogService,
    RichConsoleLogger,
    SimpleFsStorageProvider,
    SimpleRetryJoinStrategy,
} from "matrix-bot-sdk";
import { ecmLoopRun } from "./ecm_loop";
import config from "./config";
import * as path from "path";
import { Liquid } from "liquidjs";
import * as express from "express";
import * as Lob from "lob";
import { LetterManager } from "./LetterManager";
import { PgDb } from "./PgDb";
import * as fs from "fs";

LogService.setLogger(new RichConsoleLogger());
LogService.setLevel(LogLevel.DEBUG);

const asReg: IAppserviceRegistration = {
    as_token: config.matrix.appservice.asToken,
    hs_token: config.matrix.appservice.hsToken,
    sender_localpart: config.matrix.appservice.botLocalpart,
    namespaces: {
        users: [{
            regex: `@${config.matrix.appservice.userPrefix}.*:${config.matrix.appservice.domain}`,
            exclusive: true,
        }],
        aliases: [],
        rooms: [],
    },
    rate_limited: false,
    url: `http://localhost:${config.matrix.appservice.port}`,
};

if (process.argv.includes("--registration")) {
    console.log(JSON.stringify(asReg, null, 4));
    process.exit(0);
}

const storage = new SimpleFsStorageProvider(path.join(config.matrix.appservice.dataPath, "as.json"));
const opts: IAppserviceOptions = {
    bindAddress: config.matrix.appservice.address,
    port: config.matrix.appservice.port,
    homeserverName: config.matrix.appservice.domain,
    homeserverUrl: config.matrix.appservice.csUrl,
    storage: storage,
    registration: asReg,
    joinStrategy: new SimpleRetryJoinStrategy(),
};
const appservice = new Appservice(opts);
AutojoinRoomsMixin.setupOnAppservice(appservice);

const tmplPath = process.env.TMPL_PATH || './tmpl';
const lqEngine = new Liquid({
    root: tmplPath,
    cache: process.env.NODE_ENV === 'production',
});

const lob = new Lob(config.lob.apiKey);

(async function () {
    const letters = new LetterManager(
        appservice.botClient,
        await PgDb.getInstance(),
        lob,
        lqEngine,
        tmplPath,
    );

    // const pdf = await letters.makePdfFor("@travis:localhost");
    // await fs.promises.writeFile("./storage/test.pdf", pdf);

    appservice.expressAppInstance.engine('liquid', lqEngine.express());
    appservice.expressAppInstance.set('views', tmplPath);
    appservice.expressAppInstance.set('view engine', 'liquid');
    appservice.expressAppInstance.use('/assets', express.static(config.matrix.appservice.assetsPath));
    appservice.expressAppInstance.get('/', (req, res) => res.render('web_send.liquid'));

    LogService.info("index", "Starting appservice...");
    await appservice.begin();

    config.matrix.managementRoom = await appservice.botClient.joinRoom(config.matrix.managementRoom);

    await appservice.botClient.setDisplayName(config.matrix.appservice.botName);
    await appservice.botClient.setAvatarUrl(config.matrix.appservice.botAvatar);

    LogService.info("index", "Starting ECM loop...");
    await ecmLoopRun(appservice);
})();
