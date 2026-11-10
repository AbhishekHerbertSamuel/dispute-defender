import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DisputeCase } from '../../../packages/contracts/src/index.ts';
export class Store {
    readonly db: DatabaseSync;
    constructor(public directory: string, mode: 'demo' | 'sandbox') {
        mkdirSync(directory, { recursive: true });
        this.db = new DatabaseSync(resolve(directory, `${mode}.sqlite`));
        this.db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS cases (id TEXT PRIMARY KEY, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY, case_id TEXT, event TEXT, at TEXT);');
    }
    list(): DisputeCase[] { return (this.db.prepare('SELECT body FROM cases').all() as {
        body: string;
    }[]).map(r => JSON.parse(r.body)); }
    get(id: string): DisputeCase | undefined { const row = this.db.prepare('SELECT body FROM cases WHERE id=?').get(id) as {
        body: string;
    } | undefined; return row ? JSON.parse(row.body) : undefined; }
    put(c: DisputeCase) { this.db.prepare('INSERT INTO cases(id,body) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body').run(c.id, JSON.stringify(c)); }
    audit(id: string, event: string) { this.db.prepare('INSERT INTO audit(case_id,event,at) VALUES(?,?,?)').run(id, event, new Date().toISOString()); }
    events(id: string) { return this.db.prepare('SELECT event,at FROM audit WHERE case_id=? ORDER BY id DESC LIMIT 50').all(id); }
    close() { this.db.close(); }
}
