import * as fetch from "node-fetch";
import jwtDecode from "jwt-decode";
import { LogService } from "matrix-bot-sdk";

export enum ECMPieceAttribute {
    Unscanned = "unscanned",
    Scanned = "scanned",
    NoPayment = "no-payment-detected",
    Inbox = "inbox",
    NotViewed = "not-viewed",
    Viewed = "viewed",
    Stored = "stored",
    PhysicalMail = "physical-mail",
    Locked = "locked",
    Pending = "pending",
}

export enum ECMPieceAction {
    Shred = "shred",
    Scan = "scan",
    Ship = "ship",
    DepositCheck = "deposit-check",
    MoveToArchive = "move-to-archive",
}

interface ECMToken {
    access_token: string;
    expires_in: number;
    refresh_token: string;
    token_type: string;
}

interface ECMInbox {
    created_at: string;
    id: number;
    updated_at: string;
    account: {
        account_status: string;
        ecm_numbers: string[];
        id: number;
        name: string;
    };
    piece_counts: {
        scanned_piece_count: number;
        total_piece_count: number;
        unread_piece_count: number;
        unscanned_piece_count: number;
    };
}

interface ECMPieceMedia {
    content_type: string;
    file_size_in_bytes: number;
    id: string;
    tags: string[];
    url: string;
    url_valid_until: string;
    page_count: number;
    piece_id: number;
}

interface ECMPiece {
    created_at: string;
    id: number;
    updated_at: string;
    attributes: ECMPieceAttribute[];
    available_actions: ECMPieceAction[];
    barcode: string;
    carrier: {
        class: string;
        name: string;
    };
    depth_in_inches: number;
    end_user_operation_status: unknown;
    facility_id: string;
    height_in_inches: number;
    inbox_id: number;
    insights: unknown[];
    length_in_inches: number;
    license_plate: number;
    location: {
        code: string;
        id: number;
        name: string;
        type: string;
    };
    mailbox_folder_id: number;
    media: ECMPieceMedia[];
    operation_action: unknown;
    operation_status: unknown;
    page_count_actual: unknown;
    piece_sub_type: string;
    piece_type: string;
    received_at: string;
    recipient: {
        id: number;
        inbox_id: number;
        name: string;
    };
    sender: {
        address: unknown;
        name: string;
    };
    tags: ECMPieceAttribute[];
    user_defined_tags: string[];
    weight_in_ounces: number;
}

interface ECMPage<T> {
    current_page: number;
    from: number;
    to: number;
    last_page: number;
    per_page: number;
    total: number;
    data: T[];
}

export class EarthClassMailApi {
    private token: ECMToken;
    private userId: number;

    constructor(private apiUrl: string) {
    }

    public async login(username: string, password: string) {
        LogService.info("EarthClassMailApi", `Logging in with username ${username}`);
        this.token = await fetch(`${this.apiUrl}/v1/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({username, password}),
        }).then(r => r.json());
        this.userId = Number((<any>jwtDecode(this.token.access_token)).external_provider_user_id);
        setTimeout(async () => {
            // We could refresh, but this is so much easier.
            await this.login(username, password);
        }, (this.token.expires_in * 1000) / 2);
    }

    public async listInboxes(page = 1): Promise<ECMInbox[]> {
        LogService.info("EarthClassMailApi", `Listing inboxes for user ID ${this.userId}`);
        const resp: ECMPage<ECMInbox> = await fetch(`${this.apiUrl}/v1/users/${this.userId}/inboxes?page=${page}`, {
            method: 'GET',
            headers: {
                Authorization: `bearer ${this.token.access_token}`,
            },
        }).then(r => r.json());
        return resp.data;
    }

    public async listPieces(inboxId: number, page = 1): Promise<ECMPiece[]> {
        LogService.info("EarthClassMailApi", `Listing pieces for inbox ID ${inboxId}`);
        const resp: ECMPage<ECMPiece> = await fetch(`${this.apiUrl}/v1/inboxes/${inboxId}/pieces?page=${page}`, {
            method: 'GET',
            headers: {
                Authorization: `bearer ${this.token.access_token}`,
            },
        }).then(r => r.json());
        return resp.data;
    }

    public async getPieceMedia(pieceId: number, page = 1): Promise<ECMPieceMedia[]> {
        LogService.info("EarthClassMailApi", `Listing media for piece ID ${pieceId}`);
        const resp: ECMPage<ECMPieceMedia> = await fetch(`${this.apiUrl}/v1/pieces/${pieceId}/media?page=${page}`, {
            method: 'GET',
            headers: {
                Authorization: `bearer ${this.token.access_token}`,
            },
        }).then(r => r.json());
        return resp.data;
    }

    public async requestScan(pieceId: number) {
        LogService.info("EarthClassMailApi", `Requesting scan of piece ID ${pieceId}`);
        await fetch(`${this.apiUrl}/v1/pieces/${pieceId}/scans`, {
            method: 'POST',
            headers: {
                Authorization: `bearer ${this.token.access_token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                comments: "",
                post_operation_action: "store",
                scan_type: "bitonal",
            }),
        }).then(r => r.json());
    }

    public async requestDestroy(pieceId: number) {
        LogService.info("EarthClassMailApi", `Requesting destroy of piece ID ${pieceId}`);
        await fetch(`${this.apiUrl}/v1/pieces/${pieceId}/disposal`, {
            method: 'POST',
            headers: {
                Authorization: `bearer ${this.token.access_token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                delete_scans: "true",
                operation_action: "recycle",
            }),
        }).then(r => r.json());
    }

    public webUrlForPiece(piece: ECMPiece): string {
        return `https://app.earthclassmail.com/inboxes/${piece.inbox_id}/pieces/${piece.id}`;
    }
}
