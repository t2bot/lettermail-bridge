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
