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
import {Liquid} from "liquidjs";
import * as express from "express";
import { LQ_TEST } from "./TMP";
import * as htmlToPdf from "html-pdf-node";
import * as inlineImages from "inline-images";

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

(async function () {
    appservice.expressAppInstance.engine('liquid', lqEngine.express());
    appservice.expressAppInstance.set('views', tmplPath);
    appservice.expressAppInstance.set('view engine', 'liquid');
    appservice.expressAppInstance.use('/', express.static(tmplPath));
    appservice.expressAppInstance.get('/pdf', async (req, res) => {
        const f = await lqEngine.renderFile("letter.liquid", LQ_TEST);
        const inlined = inlineImages(f, tmplPath).toString();
        const pdf = await htmlToPdf.generatePdf({content: inlined}, {
            printBackground: true,
            format: 'letter',
            margin: {
                top: '0.1in',
                right: '0.1in',
                left: '0.1in',
                bottom: '0.1in',
            },
        });
        res.header('Content-Type', 'application/pdf');
        return res.send(pdf);
    });
    appservice.expressAppInstance.get('/test', (req, res) => {
        return res.render('letter.liquid', LQ_TEST);
    });

    LogService.info("index", "Starting appservice...");
    await appservice.begin();

    config.matrix.managementRoom = await appservice.botClient.resolveRoom(config.matrix.managementRoom);

    await appservice.botClient.setDisplayName(config.matrix.appservice.botName);
    await appservice.botClient.setAvatarUrl(config.matrix.appservice.botAvatar);

    LogService.info("index", "Starting ECM loop...");
    await ecmLoopRun(appservice);
})();
