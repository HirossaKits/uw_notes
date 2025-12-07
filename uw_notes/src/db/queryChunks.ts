import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import * as sqliteVec from "sqlite-vec";
import { crateEmbedding } from "@/llm/embedding";

export function queryChunks(db: Database, embedding: number[], limit = 5) {
  
  const stmt = db.prepare(`
    SELECT
      distance,
      meta
    FROM vec_items
    WHERE embedding MATCH ?
    ORDER BY distance
    LIMIT ?
  `);

  return stmt.all(embedding, limit);
}

async function main() {

const dbDir = path.join(process.cwd(), "db");
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir);

const dbPath = path.join(dbDir, "vector_store.sqlite3");
const db = new Database(dbPath);

// sqlite-vec を有効化
sqliteVec.load(db);

const stmt = db.prepare(`
  SELECT
    vector_distance(embedding, ?) AS score,
    meta
  FROM vec_items
  WHERE embedding MATCH ?
  ORDER BY score DESC
  LIMIT 10
`);

const embedding = await crateEmbedding("publisher");
const embeddingBlob = Buffer.from(new Float32Array(embedding).buffer);

const result = await stmt.all(embeddingBlob) as {
  score: number;
  meta: string;
}[];

for (const r of result) {
  const meta = JSON.parse(r.meta);
  console.log("--------------------------------");
  console.log(r.score);
  console.log(meta.text);
  console.log("--------------------------------");
}

}

main();