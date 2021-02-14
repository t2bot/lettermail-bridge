import { Pool } from "pg";
import config from "./config";
import { LogService } from "matrix-bot-sdk";

export enum MailState {
    Unknown = "unknown",
    Processed = "processed",
    Unroutable = "unroutable",
    Invalid = "invalid",
}

export class PgDb {
    private static internalInstance: PgDb;

    private constructor(private client: Pool) {
    }

    private async migrateUp() {
        LogService.info("PgDb", "Migrating up...");
        await this.client.query("CREATE TABLE IF NOT EXISTS ecm_letters (piece_id INTEGER NOT NULL PRIMARY KEY, state TEXT NOT NULL);");
        await this.client.query("CREATE TABLE IF NOT EXISTS lob_room_subscriptions (user_id TEXT NOT NULL, room TEXT NOT NULL, PRIMARY KEY (user_id, room));");
        await this.client.query("CREATE TABLE IF NOT EXISTS lob_addresses (user_id TEXT NOT NULL UNIQUE, addr TEXT NOT NULL, PRIMARY KEY (user_id, addr));");
    }

    public async setMailState(pieceId: number, state: MailState) {
        LogService.info("PgDb", `Setting ${pieceId} mail state to ${state}`);
        await this.client.query("INSERT INTO ecm_letters (piece_id, state) VALUES ($1, $2) ON CONFLICT (piece_id) DO UPDATE SET state = $2;", [pieceId, state]);
    }

    public async getMailState(pieceId: number): Promise<MailState> {
        LogService.info("PgDb", `Getting ${pieceId} mail state`);
        const r = await this.client.query("SELECT state FROM ecm_letters WHERE piece_id = $1", [pieceId]);
        if (r.rows?.length) return r.rows[0].state;
        return MailState.Unknown;
    }

    public async setAddress(userId: string, lobAddr: string) {
        LogService.info("PgDb", `Setting ${userId} address to ${lobAddr}`);
        await this.client.query("INSERT INTO lob_addresses (user_id, addr) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET addr = $2", [userId, lobAddr]);
    }

    public async getAddress(userId: string): Promise<string> {
        LogService.info("PgDb", `Getting ${userId} address`);
        const r = await this.client.query("SELECT addr FROM lob_addresses WHERE user_id = $1", [userId]);
        if (r.rows?.length) return r.rows[0].addr;
        return null;
    }

    public async getSubscribedRooms(userId: string): Promise<string[]> {
        LogService.info("PgDb", `Getting ${userId} subscribed rooms`);
        const r = await this.client.query("SELECT room FROM lob_room_subscriptions WHERE user_id = $1", [userId]);
        if (r.rows?.length) return r.rows.map(e => e.room);
        return [];
    }

    public static async getInstance(): Promise<PgDb> {
        if (PgDb.internalInstance) {
            return PgDb.internalInstance;
        }

        const pool = new Pool({
            host: config.database.host,
            port: config.database.port,
            user: config.database.username,
            password: config.database.password,
            database: config.database.database,

            // sslmode parsing is largely interpreted from pg-connection-string handling
            ssl: config.database.sslmode === 'disable' ? false : {
                rejectUnauthorized: config.database.sslmode === 'no-verify',
            },
        });
        await pool.connect();
        PgDb.internalInstance = new PgDb(pool);
        await PgDb.internalInstance.migrateUp();
        return PgDb.internalInstance;
    }
}
