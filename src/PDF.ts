import * as pdf2html from "pdf2html";
import { promises as fs } from "fs";
import * as tmp from "tmp-promise";
import * as pdfjs from "pdfjs-dist/es5/build/pdf.js";
import { createCanvas } from "canvas";
import { PNG } from "pngjs";
import jsQR, { QRCode } from "jsqr";
import { Permalinks } from "matrix-bot-sdk";

export class PDF {
    private constructor() {
    }

    public static async renderHtml(bytes: ArrayBuffer): Promise<string[]> {
        const f = await tmp.file();
        try {
            await fs.writeFile(f.path, Buffer.from(bytes));
            const pages = await new Promise<string[]>((resolve, reject) => {
                pdf2html.pages(f.path, (err, htmlPages) => {
                    if (err) return reject(err);
                    resolve(htmlPages);
                });
            });
            return pages;
        } finally {
            await f.cleanup();
        }
    }

    public static async extractRoomRoute(bytes: ArrayBuffer): Promise<string> {
        const f = await tmp.file();
        try {
            await fs.writeFile(f.path, Buffer.from(bytes));

            const doc = await pdfjs.getDocument(f.path).promise;
            let qrcode: QRCode = null;
            for (let i = 1; i <= doc.numPages; i++) {
                const page = await doc.getPage(i);
                const viewport = page.getViewport({scale: 1.5});
                const canvas = createCanvas(viewport.width, viewport.height);
                const context = canvas.getContext('2d');
                await page.render({canvasContext: context, viewport}).promise;
                const png = PNG.sync.read(canvas.toBuffer());
                qrcode = jsQR(png.data, png.width, png.height, {inversionAttempts: "attemptBoth"});
                if (qrcode && qrcode.data.includes("https://matrix.to/#/")) {
                    break;
                } else {
                    qrcode = null;
                }
            }
            if (!qrcode) {
                return null;
            }
            if (qrcode.data.startsWith("URL:")) {
                qrcode.data = qrcode.data.substring("URL:".length);
            }
            if (!qrcode.data.startsWith("https://matrix.to/#/")) {
                return null;
            }
            const link = Permalinks.parseUrl(qrcode.data);
            return link.roomIdOrAlias;
        } finally {
            await f.cleanup();
        }
    }
}
