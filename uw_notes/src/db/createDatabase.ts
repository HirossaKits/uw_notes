import Database from "better-sqlite3";
import * as path from "node:path";
import * as fs from "node:fs";

export function createDatabase() {
  const dbDir = path.join(process.cwd(), "db");
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir);

  const dbPath = path.join(dbDir, "vectors.db");
  const db = new Database(dbPath);

  // sqlite-vec を有効化
  db.loadExtension("vec0");

  db.exec(`
    CREATE TABLE IF NOT EXISTS chunks (
      id INTEGER PRIMARY KEY,
      text TEXT,
      embedding VECTOR,
      start_page INTEGER,
      end_page INTEGER,
      bbox_start TEXT,
      bbox_end TEXT,
      start_offset INTEGER,
      end_offset INTEGER,
      source TEXT
    );
  `);

  return db;
}
