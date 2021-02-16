import { LogService, MatrixClient, MessageEvent } from "matrix-bot-sdk";
import { PgDb } from "./PgDb";
import * as Lob from "lob";
import { Liquid } from "liquidjs";
import * as htmlToPdf from "html-pdf-node";
import * as inlineImages from "inline-images";
import * as moment from "moment";
import config from "./config";

interface LQMessage {
    name: string;
    avatar?: string;
    kind: string;
    body: string;
}

interface LQRoom {
    name?: string;
    avatar?: string;
    messages: LQMessage[];
}

export class LetterManager {
    constructor(
        private client: MatrixClient,
        private db: PgDb,
        private lob: Lob,
        private lqEngine: Liquid,
        private tmplPath: string,
    ) {
    }

    public async createAddress(userId: string, name: string, line1: string, line2: string, city: string, state: string, zip: string, country: string): Promise<string> {
        const existingAddrId = await this.db.getAddress(userId);
        if (existingAddrId) {
            await this.lob.addresses.delete(existingAddrId);
        }
        const addr = await this.lob.addresses.create({
            description: userId,
            name,
            address_line1: line1,
            address_line2: line2,
            address_city: city,
            address_state: state,
            address_zip: zip,
            address_country: country,
            metadata: {
                mx_user_id: userId,
            },
        });
        await this.db.setAddress(userId, addr.id);
        return addr.id;
    }

    private async compileRooms(userId: string): Promise<LQRoom[]> {
        const rooms = await this.db.getSubscribedRooms(userId);
        const compiled: LQRoom[] = [];
        for (const roomRef of rooms) {
            if (compiled.length >= config.lob.maxRooms) break;

            try {
                const roomId = await this.client.resolveRoom(roomRef);
                const messages = await this.client.doRequest("GET", `/_matrix/client/r0/rooms/${encodeURIComponent(roomId)}/messages`, {
                    dir: "b",
                    limit: 15,
                    filter: JSON.stringify({
                        limit: 15,
                        types: ["m.room.message"],
                    }),
                });
                const lqMessages: LQMessage[] = [];
                for (const event of (messages?.chunk || [])) {
                    if (lqMessages.length >= config.lob.maxMessagesPerRoom) break;

                    const ev = new MessageEvent(event);
                    if (ev.isRedacted) continue;
                    if (!["m.text", "m.emote", "m.notice"].includes(ev.messageType)) continue;
                    if (ev.sender === userId) continue;

                    const msg: LQMessage = {
                        avatar: null,
                        body: ev.textBody,
                        kind: ev.messageType,
                        name: ev.sender,
                    };
                    try {
                        const profile = await this.client.getUserProfile(ev.sender);
                        if (profile?.displayname) msg.name = profile.displayname;
                        if (profile?.avatar_url?.startsWith("mxc://")) {
                            const mxcTrimmed = profile.avatar_url.substring("mxc://".length).split('?')[0];
                            msg.avatar = `${this.client.homeserverUrl}/_matrix/media/r0/thumbnail/${mxcTrimmed}?width=96&height=96&method=crop&animated=false`;
                        }
                    } catch (e) {
                        LogService.warn(`LetterManager#user:${userId}`, e);
                    }
                    lqMessages.push(msg);
                }
                if (lqMessages.length) {
                    let roomName: string = null;
                    let roomAvatar: string = null;
                    try {
                        const ev = await this.client.getRoomStateEvent(roomId, "m.room.avatar", "");
                        if (ev?.url?.startsWith("mxc://")) {
                            const mxcTrimmed = ev.url.substring("mxc://".length).split('?')[0];
                            roomAvatar = `${this.client.homeserverUrl}/_matrix/media/r0/thumbnail/${mxcTrimmed}?width=96&height=96&method=crop&animated=false`;
                        }
                    } catch (e) {
                        LogService.warn(`LetterManager#user:${userId}`, e);
                    }
                    try {
                        const ev = await this.client.getRoomStateEvent(roomId, "m.room.name", "");
                        if (ev?.name) roomName = ev.name;
                    } catch (e) {
                        LogService.warn(`LetterManager#user:${userId}`, e);
                    }
                    if (!roomName) {
                        try {
                            const ev = await this.client.getRoomStateEvent(roomId, "m.room.canonical_alias", "");
                            if (ev?.alias) roomName = ev.alias;
                        } catch (e) {
                            LogService.warn(`LetterManager#user:${userId}`, e);
                        }
                    }
                    compiled.push({
                        name: roomName,
                        avatar: roomAvatar,
                        messages: lqMessages.reverse(),
                    });
                }
            } catch (e) {
                LogService.warn(`LetterManager#user:${userId}`, e);
            }
        }
        return compiled;
    }

    public async makePdfFor(userId: string): Promise<Buffer> {
        const rooms = await this.compileRooms(userId);
        if (!rooms.length) return null;
        const f = await this.lqEngine.renderFile("letter.liquid", {
            unsubCode: "TODO 1234",
            dateFriendly: moment().format('dddd, MMMM do, YYYY'),
            rooms: rooms,
        });
        const inlined = inlineImages(f, config.matrix.appservice.assetsPath).toString();
        return await htmlToPdf.generatePdf({content: inlined}, {
            printBackground: true,
            format: 'letter',
            margin: {
                top: '0.1in',
                right: '0.1in',
                left: '0.1in',
                bottom: '0.1in',
            },
        });
    }
}
