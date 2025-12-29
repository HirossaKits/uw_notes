import * as sqliteVec from "sqlite-vec";
import Database from "better-sqlite3";
import * as fs from "node:fs";
import { PATHS } from "@/config/paths";

export const database = createDatabase();

export function createDatabase() {
  const dbDir = PATHS.DB;
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir);

  const dbPath = PATHS.DATABASE;
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