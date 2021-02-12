import { LogLevel, LogService, RichConsoleLogger } from "matrix-bot-sdk";
import { ecmLoopRun } from "./ecm_loop";

LogService.setLogger(new RichConsoleLogger());
LogService.setLevel(LogLevel.DEBUG);

(async function () {
    await ecmLoopRun();

    process.exit(0);
})();
