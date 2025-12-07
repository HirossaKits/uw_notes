import * as sqliteVec from "sqlite-vec";
import Database from "better-sqlite3";
import * as path from "node:path";
import * as fs from "node:fs";

export function createDatabase() {
  const dbDir = path.join(process.cwd(), "db");
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir);

  const dbPath = path.join(dbDir, "vector_store.sqlite3");
  const db = new Database(dbPath);

  // sqlite-vec を有効化
  sqliteVec.load(db);

  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS vec_items USING vec0(
      embedding float[3072],
          meta TEXT
    );
  `);

  return db;
}
