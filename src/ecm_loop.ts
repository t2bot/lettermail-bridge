import config from "./config";
import { LogService } from "matrix-bot-sdk";
import { EarthClassMailApi, ECMPieceAttribute } from "./EarthClassMailApi";
import { PDF } from "./PDF";
import * as fetch from "node-fetch";

const ecmApi = new EarthClassMailApi(config.earthClassMail.apiUrl);
const POLL_MS = 2 * 60 * 60 * 1000; // 2 hours

export async function ecmLoopPrepare() {
    await ecmApi.login(config.earthClassMail.username, config.earthClassMail.password);

    if (config.earthClassMail.inboxId <= 0) {
        const inboxes = await ecmApi.listInboxes();
        config.earthClassMail.inboxId = inboxes[0].id;
    }
    LogService.info("ecm_loop#ecmLoopPrepare", `Using inbox ID ${config.earthClassMail.inboxId}`);
}

export async function ecmLoopRun() {
    await ecmLoopPrepare();
    const fn = async () => {
        const pieces = await ecmApi.listPieces(config.earthClassMail.inboxId);
        const scanned = pieces.filter(p => p.attributes.includes(ECMPieceAttribute.Scanned));
        const pendingScan = pieces.filter(p => p.attributes.includes(ECMPieceAttribute.Unscanned) && p.attributes.includes(ECMPieceAttribute.Pending));
        const notScanned = pieces.filter(p => p.attributes.includes(ECMPieceAttribute.Unscanned) && !p.attributes.includes(ECMPieceAttribute.Pending));

        LogService.info("ecm_loop#ecmLoopRun", `${pendingScan.length} pieces are pending a scan`);

        for (const piece of scanned) {
            const media = await ecmApi.getPieceMedia(piece.id);
            const pdf = media.find(m => m.content_type.toLowerCase() === 'application/pdf');
            if (!pdf) throw new Error("Cannot find PDF"); // TODO: Convert to management user error

            const data = await fetch(pdf.url).then(r => r.arrayBuffer());
            const htmlPages = await PDF.renderHtml(data);
            htmlPages.splice(0, 1); // envelope
            const routedRoom = await PDF.extractRoomRoute(data);
            if (!routedRoom) throw new Error("Mail not routable"); // TODO: Convert to management user error
            console.log("Routing: " + routedRoom);
        }

        for (const piece of notScanned) {
            await ecmApi.requestScan(piece.id);
        }

    };
    setTimeout(fn, POLL_MS);
    await fn();
}
