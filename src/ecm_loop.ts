import config from "./config";
import { Appservice, LogService } from "matrix-bot-sdk";
import { EarthClassMailApi, ECMPieceAttribute } from "./EarthClassMailApi";
import { PDF } from "./PDF";
import * as fetch from "node-fetch";
import { sha256 } from "./utils";

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

export async function ecmLoopRun(appservice: Appservice) {
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
            if (!pdf) {
                // TODO: Flag skipped
                const pieceUrl = ecmApi.webUrlForPiece(piece);
                await appservice.botClient.sendNotice(config.matrix.managementRoom, `No PDF available for mail: ${pieceUrl}`);
                continue;
            }

            const data = await fetch(pdf.url).then(r => r.arrayBuffer());
            const htmlPages = await PDF.renderHtml(data);
            htmlPages.splice(0, 1); // envelope
            const routedRoom = await PDF.extractRoomRoute(data);
            if (!routedRoom) {
                // TODO: Flag skipped
                const pieceUrl = ecmApi.webUrlForPiece(piece);
                await appservice.botClient.sendNotice(config.matrix.managementRoom, `Unroutable mail: ${pieceUrl}`);
                continue;
            }

            const maskedUserId = sha256(`mail-${piece.sender?.name || piece.id}`);
            let displayName = piece.sender?.name;
            if (displayName) {
                displayName = displayName.split('\n')[0].trim();
            }
            if (!displayName) {
                displayName = config.matrix.defaultName;
            }
            const intent = appservice.getIntentForSuffix(maskedUserId);
            let resolvedRoomId = "unresolved";
            try {
                resolvedRoomId = await appservice.botClient.resolveRoom(routedRoom);

                await intent.ensureRegistered();

                try {
                    await intent.underlyingClient.joinRoom(routedRoom);
                } catch (e) {
                    LogService.warn("ecm_loop#ecmRunLoop", e);
                }
                await intent.ensureJoined(resolvedRoomId);

                try {
                    await intent.underlyingClient.setDisplayName(displayName);
                    await intent.underlyingClient.setAvatarUrl(config.matrix.defaultAvatar);
                } catch (e) {
                    LogService.warn("ecm_loop#ecmRunLoop", e);
                }

                for (const page of htmlPages) {
                    await intent.underlyingClient.sendHtmlText(resolvedRoomId, page);
                }
            } catch (e) {
                // TODO: Flag skipped
                const pieceUrl = ecmApi.webUrlForPiece(piece);
                await appservice.botClient.sendNotice(config.matrix.managementRoom, `Unable to send mail ${pieceUrl} to ${routedRoom} (${resolvedRoomId}): ${e?.message || e?.body?.message}`);
                LogService.error("ecm_loop#ecmRunLoop", e);
                continue;
            }
        }

        for (const piece of notScanned) {
            await ecmApi.requestScan(piece.id);
        }
    };
    const runFn = async () => {
        try {
            await fn();
        } catch (e) {
            LogService.error("ecm_loop#ecmRunLoop", e);
        }
        setTimeout(runFn, POLL_MS);
    };
    setTimeout(runFn, POLL_MS);
    await fn();
}
