import type { DreamRecord } from "../shared/schemas";

/**
 * Storage for dreams, scoped by device id until real accounts exist.
 * TODO(before launch): encrypt dream text at rest (see plan, section 9).
 */
export interface DreamRepo {
  insert(deviceId: string, dream: DreamRecord): Promise<void>;
  list(deviceId: string, limit: number): Promise<DreamRecord[]>;
  get(deviceId: string, id: string): Promise<DreamRecord | null>;
}

interface DreamRow {
  id: string;
  created_at: string;
  text: string;
  mood: string | null;
  concern: string | null;
  lens: string;
  interpretation_json: string | null;
  notices_json: string;
}

const fromRow = (row: DreamRow): DreamRecord => ({
  id: row.id,
  createdAt: row.created_at,
  text: row.text,
  mood: row.mood as DreamRecord["mood"],
  concern: row.concern as DreamRecord["concern"],
  lens: row.lens as DreamRecord["lens"],
  interpretation: row.interpretation_json ? JSON.parse(row.interpretation_json) : null,
  notices: JSON.parse(row.notices_json),
});

export class D1DreamRepo implements DreamRepo {
  constructor(private readonly db: D1Database) {}

  async insert(deviceId: string, dream: DreamRecord): Promise<void> {
    const statements = [
      this.db
        .prepare(
          `INSERT INTO dreams (id, device_id, created_at, text, mood, concern, lens, interpretation_json, notices_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          dream.id,
          deviceId,
          dream.createdAt,
          dream.text,
          dream.mood,
          dream.concern,
          dream.lens,
          dream.interpretation ? JSON.stringify(dream.interpretation) : null,
          JSON.stringify(dream.notices),
        ),
    ];

    // Symbols feed the future symbol map and recurring-dream detection.
    const symbols = new Set(
      (dream.interpretation?.symbols ?? []).map((s) => s.name.trim().toLowerCase()).filter(Boolean),
    );
    for (const symbol of symbols) {
      statements.push(
        this.db
          .prepare("INSERT INTO dream_symbols (dream_id, device_id, symbol) VALUES (?, ?, ?)")
          .bind(dream.id, deviceId, symbol),
      );
    }

    await this.db.batch(statements);
  }

  async list(deviceId: string, limit: number): Promise<DreamRecord[]> {
    const { results } = await this.db
      .prepare("SELECT * FROM dreams WHERE device_id = ? ORDER BY created_at DESC LIMIT ?")
      .bind(deviceId, limit)
      .all<DreamRow>();
    return results.map(fromRow);
  }

  async get(deviceId: string, id: string): Promise<DreamRecord | null> {
    const row = await this.db
      .prepare("SELECT * FROM dreams WHERE device_id = ? AND id = ?")
      .bind(deviceId, id)
      .first<DreamRow>();
    return row ? fromRow(row) : null;
  }
}

export class MemoryDreamRepo implements DreamRepo {
  private readonly rows = new Map<string, { deviceId: string; dream: DreamRecord }>();

  async insert(deviceId: string, dream: DreamRecord): Promise<void> {
    this.rows.set(dream.id, { deviceId, dream });
  }

  async list(deviceId: string, limit: number): Promise<DreamRecord[]> {
    return [...this.rows.values()]
      .filter((r) => r.deviceId === deviceId)
      .map((r) => r.dream)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async get(deviceId: string, id: string): Promise<DreamRecord | null> {
    const row = this.rows.get(id);
    return row && row.deviceId === deviceId ? row.dream : null;
  }
}
